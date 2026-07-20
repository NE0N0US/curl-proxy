import undici from 'undici'

import {ProxyConfig} from '../types.ts'
import {checkAbortSignal} from '../utils.ts'
import {AcceptEncodingHeader, Header, HttpMethod, HttpStatus, ACCEPT_ENCODING_HEADER_ALL, resolveAcceptHeader, resolveUrl, streamify} from '../http.ts'

import {proxyDebugResponse, configWithFallbacks} from './config.ts'
import {SearchParam, parseParams} from './params.ts'
import {processReqHeaders, parseRecursionHeader, processResHeaders} from './headers.ts'
import {ResBodyParam, encodeBody, throttleBody, trackBody, transformBody} from './body.ts'
import {helpResponse} from './help.ts'
import {processCustom} from './custom.ts'

export {type ProxyConfig, configWithFallbacks, proxyDebugResponse}

export const ENDPOINT_PROXY = '/api/proxy'

export const ENDPOINT_PROXY_DEBUG = '/api/curl-proxy-config'

export function createProxy(
	configInit?: Partial<ProxyConfig>,
	consoleObj: Partial<typeof globalThis.console> = console,
	/** `quickjs-emscripten` has an issue where errors thrown by the context disposal scheduler cannot be caught normally and must be handled via the process `uncaughtException` handler. Otherwise, the process exits with an error code. Additionally, `quickjs-emscripten` calls `console.error()` when reporting other errors. */
	onProcessUncaughtException: (error: Error) => any =
		error => consoleObj.error?.('[uncaught]', error)
) {
	const
		config = configWithFallbacks(configInit),
		dispatcher = new undici.Agent({
			connect: {timeout: config.globalTimeout},
			headersTimeout: config.globalTimeout,
			bodyTimeout: config.globalTimeout,
			strictContentLength: false,
			allowH2: true,
			autoSelectFamily: true,
			maxHeaderSize: 2 ** 16,
		}),
		console = consoleObj

	if (onProcessUncaughtException && !(
		process.listeners?.('uncaughtException') ?? []
	).includes(onProcessUncaughtException))
		process.addListener?.('uncaughtException', onProcessUncaughtException)

	// #region - functions

	/** @throws {DOMException | TypeError} if `fetch()` [failed](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch#exceptions) for main request */
	async function fetchMulti(req: Request, params: URLSearchParams) {
		// send requests
		const
			urls = params.getAll(SearchParam.URL)
				.slice(0, config.urlCountMax)
				.map(url => resolveUrl(url, req.url)),
			requestAborters = urls.map(() => new AbortController()),
			responsePromises = urls.map((url, index) => {
				const headers = req.headers
				if (params.get(SearchParam.SKIP_DEFAULTS) === null)
					headers.set(Header.HOST, new URL(url).host)
				const request = new Request(url, new Request(
					(urls.length > 1 || params.get(SearchParam.RES_BODY)
						?.startsWith(ResBodyParam.JAVASCRIPT)) ? req.clone() : req,
					{
						headers,
						signal: AbortSignal.any([
							req.signal,
							requestAborters[index].signal,
						]),
					}
				))
				// @ts-expect-error: https://undici.nodejs.org/api/Fetch#fetchinput-init
				return fetch(request, {dispatcher}).then(res => {
					requestAborters.splice(index, 1)
					return res
				})
			}),
			responsesPromise = Promise.allSettled(responsePromises)
		// get response(s)
		let
			responses: PromiseSettledResult<Response>[] = [],
			res: Response,
			resIndex: number | undefined
		if (params.get(SearchParam.FASTEST) === null) {
			responses = await responsesPromise
			if (responses[0].status === 'rejected')
				throw responses[0].reason
			else
				res = responses[0].value
			responses.shift()
		}
		else {
			[res, resIndex] = await Promise.any(responsePromises.map((promise, resIndex) =>
				promise.then(res => [res, resIndex]) as Promise<[Response, number]>
			))
			requestAborters.forEach(aborter => aborter.abort())
		}
		return {res, resIndex, responses}
	}

	/** facade */
	async function proxy(req: Request, consoleCounter = 0, depth = 0, attempt = 0): Promise<Response> {
		checkAbortSignal(req.signal)
		const
			now = Date.now(),
			searchParams = new URL(req.url).searchParams,
			{params, resbody, status, retry, retryIn, retryFactor, retryLimit, ttfb,
				throttle, throttleUp, doRunCustom, timeout} = parseParams(searchParams),
			consolePrefix = `[${consoleCounter || '*'}:${depth || '*'}:${attempt || '*'}] `
		let recursion = parseRecursionHeader(req.headers)
		if (recursion > config.proxyRecursionMax)
			return await helpResponse(req, config, HttpStatus.LOOP_DETECTED,
				`Proxy recursion limit of ${config.proxyRecursionMax} exceeded`
			)
		if (!searchParams.get(SearchParam.URL))
			return await helpResponse(req, config, HttpStatus.BAD_REQUEST)
		try {
			// modify request
			const
				method = (params[SearchParam.METHOD] || req.method).toUpperCase(),
				signal = AbortSignal.any([
					req.signal,
					...timeout ? [AbortSignal.timeout(timeout)] : [],
				]),
				headers = new Headers(req.headers),
				newReq = new Request(req, {
					method,
					body: ([HttpMethod.GET, HttpMethod.HEAD].includes(method as HttpMethod)
						? undefined : streamify(params[SearchParam.BODY]))
						?? throttleBody(
							(retry > attempt ? req.clone() : req).body,
							throttleUp || throttle,
							{signal}
						),
					headers: processReqHeaders(req.headers, searchParams),
					signal,
					// @ts-expect-error: https://undici.nodejs.org/api/Fetch#fetchinput-init
					duplex: 'half',
				})
			// send requests
			if (!attempt)
				console.time?.(consolePrefix + 'fetch')
			const
				{res, resIndex, responses} = await fetchMulti(newReq, searchParams),
				resHeaders = new Headers(res.headers)
			if (retry === attempt)
				console.timeEnd?.(consolePrefix + 'fetch')
			recursion = Math.max(
				recursion,
				parseRecursionHeader(res.headers),
				...responses.map(res => res.status === 'fulfilled'
					? parseRecursionHeader(res.value.headers) : 0
				)
			)
			if (recursion > config.proxyRecursionMax)
				return await helpResponse(req, config, HttpStatus.LOOP_DETECTED,
					`Proxy recursion limit of ${config.proxyRecursionMax} exceeded`
				)
			// modify response
			if (resIndex !== undefined)
				resHeaders.set(Header.X_PROXY_RESPONSES, resIndex?.toString())
			else if (responses.length)
				resHeaders.set(Header.X_PROXY_RESPONSES, responses.map(result =>
					result.status === 'fulfilled' ? result.value.status : null
				).join(','))
			const
				acceptEncoding = resolveAcceptHeader(headers.get(Header.ACCEPT_ENCODING),
					ACCEPT_ENCODING_HEADER_ALL, AcceptEncodingHeader.ANY),
				contentEncoding = acceptEncoding === AcceptEncodingHeader.ANY
					? AcceptEncodingHeader.DEFAULT : acceptEncoding,
				{request, body: newResBody, ...newResInit} = await processCustom(
					newReq, res, responses.map(
						response => response.status === 'fulfilled' ? response.value : null
					),
					{
						body: doRunCustom ? res.clone().body : res.body,
						headers: processResHeaders(resHeaders, searchParams, contentEncoding, headers),
						status: status || res.status,
						statusText: params[SearchParam.STATUS_TEXT] ?? res.statusText,
					},
					doRunCustom ? resbody.slice(ResBodyParam.JAVASCRIPT.length) : undefined,
					config.runCustomMs, config.runCustomBytes, config.runCustomUnsafe,
					error => console.error?.(consolePrefix + 'error:', error)
				)
			;(request ? request.headers : newResInit.headers as Headers)
				.set(Header.X_PROXY_RECURSION, (recursion + 1)?.toString())
			// delay response
			if (Date.now() - now < ttfb)
				await new Promise(resolve => setTimeout(resolve,
					Math.max(0, ttfb - (Date.now() - now))
				))
			// pipe response
			return request ? await proxy(request, consoleCounter, depth + 1, 0) : new Response(
				trackBody(
					throttleBody(
						encodeBody(
							transformBody(newResBody, resbody, req.signal),
							contentEncoding,
							req.signal
						),
						throttle,
						{signal: req.signal}
					),
					last => last ? console.timeEnd?.(consolePrefix + 'body') : console.time?.(consolePrefix + 'body')
				),
			newResInit)
		}
		catch (error) {
			console.error?.(consolePrefix + 'error:', error)
			// retry in
			if (retry > attempt && retryIn)
				await new Promise(resolve => setTimeout(
					resolve,
					Math.min(retryIn * ((retryFactor || 1) ** attempt), retryLimit || Infinity)
				))
			checkAbortSignal(req.signal)
			return retry > attempt
				? await proxy(req, consoleCounter, depth, attempt + 1)
				: await helpResponse(req, config, HttpStatus.INTERNAL_SERVER_ERROR,
					error?.toString() ?? 'Unknown error'
				)
		}
	}

	// #endregion

	return proxy as (req: Request) => Promise<Response>
}
