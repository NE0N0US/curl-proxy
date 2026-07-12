import {PROXY_RECURSION_MAX, URL_COUNT_MAX} from '../env'
import {checkAbortSignal} from '../utils'
import {AcceptEncodingHeader, Header, HttpMethod, HttpStatus, ACCEPT_ENCODING_HEADER_ALL, resolveAcceptHeader, resolveUrl, streamify} from '../http'

import {SearchParam, parseParams} from './params'
import {processReqHeaders, parseRecursionHeader, processResHeaders} from './headers'
import {ResBodyParam, encodeBody, throttleBody, trackBody, transformBody} from './body'
import {helpResponse} from './help'
import {processCustom} from './custom'

// #region - functions

/** @throws {DOMException | TypeError} if `fetch()` [failed](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch#exceptions) for main request */
async function fetchMulti(request: Request, params: URLSearchParams) {
	// send requests
	const
		urls = params.getAll(SearchParam.URL)
			.slice(0, URL_COUNT_MAX)
			.map(url => resolveUrl(url, request.url)),
		requestAborters = urls.map(() => new AbortController()),
		responsePromises = urls.map((url, index) => {
			const headers = request.headers
			if (params.get(SearchParam.SKIP_DEFAULTS) === null)
				headers.set(Header.HOST, new URL(url).host)
			return fetch(url, new Request(
				(urls.length > 1 || params.get(SearchParam.RES_BODY)
					?.startsWith(ResBodyParam.JAVASCRIPT)) ? request.clone() : request,
				{
					headers,
					signal: AbortSignal.any([
						request.signal,
						requestAborters[index].signal,
					]),
				}
			)).then(res => {
				requestAborters.splice(index, 1)
				return res
			})
		}),
		responsesPromise = Promise.allSettled(responsePromises)
	// get response(s)
	let
		responses: PromiseSettledResult<Response>[] = [],
		res: Response
	if (params.get(SearchParam.FASTEST) === null) {
		responses = await responsesPromise
		if (responses[0].status === 'rejected')
			throw responses[0].reason
		else
			res = responses[0].value
		responses.shift()
	}
	else {
		res = await Promise.any(responsePromises)
		requestAborters.forEach(aborter => aborter.abort())
	}
	return {res, responses}
}

/** facade */
export async function proxy(req: Request, consoleCounter = 0, depth = 0, attempt = 0): Promise<Response> {
	checkAbortSignal(req.signal)
	const
		now = Date.now(),
		searchParams = new URL(req.url).searchParams,
		{params, resbody, status, retry, retryIn, retryFactor, retryLimit, ttfb,
			throttle, throttleUp, doRunCustom, timeout} = parseParams(searchParams),
		consolePrefix = `[${consoleCounter || '*'}:${depth || '*'}:${attempt || '*'}] `
	let recursion = parseRecursionHeader(req.headers)
	if (recursion > PROXY_RECURSION_MAX)
		return await helpResponse(req, HttpStatus.LOOP_DETECTED,
			`Proxy recursion limit of ${PROXY_RECURSION_MAX} exceeded`
		)
	if (!searchParams.get(SearchParam.URL))
		return await helpResponse(req, HttpStatus.BAD_REQUEST)
	try {
		// modify request
		const
			method = (params[SearchParam.METHOD] || req.method).toUpperCase(),
			signal = AbortSignal.any([
				req.signal,
				...timeout ? [AbortSignal.timeout(timeout)] : [],
			]),
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
				// @ts-expect-error
				duplex: 'half',
			})
		// send requests
		if (!attempt)
			console.time(consolePrefix + 'fetch')
		const
			{res, responses} = await fetchMulti(newReq, searchParams),
			resHeaders = new Headers(res.headers)
		if (retry === attempt)
			console.timeEnd(consolePrefix + 'fetch')
		recursion = Math.max(
			recursion,
			parseRecursionHeader(res.headers),
			...responses.map(res => res.status === 'fulfilled'
				? parseRecursionHeader(res.value.headers) : 0
			)
		)
		if (recursion > PROXY_RECURSION_MAX)
			return await helpResponse(req, HttpStatus.LOOP_DETECTED,
				`Proxy recursion limit of ${PROXY_RECURSION_MAX} exceeded`
			)
		// modify response
		if (responses.length)
			resHeaders.set(Header.X_PROXY_RESPONSES, JSON.stringify(
				responses.map(result =>
					result.status === 'fulfilled' ? result.value.status : null
				)
			))
		const
			acceptEncoding = resolveAcceptHeader(req.headers.get(Header.ACCEPT_ENCODING),
				ACCEPT_ENCODING_HEADER_ALL, AcceptEncodingHeader.ANY),
			contentEncoding = acceptEncoding === AcceptEncodingHeader.ANY
				? AcceptEncodingHeader.DEFAULT : acceptEncoding,
			{request, body: newResBody, ...newResInit} = await processCustom(newReq, res, responses.map(
				response => response.status === 'fulfilled' ? response.value : null
			), {
				body: doRunCustom ? res.clone().body : res.body,
				headers: processResHeaders(resHeaders, searchParams, contentEncoding),
				status: status || res.status,
				statusText: params[SearchParam.STATUS_TEXT] ?? res.statusText,
			}, doRunCustom ? resbody.slice(ResBodyParam.JAVASCRIPT.length) : undefined)
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
				consolePrefix
			),
		newResInit)
	}
	catch (error) {
		console.error(consolePrefix + 'error', error)
		// retry in
		if (retry > attempt && retryIn)
			await new Promise(resolve => setTimeout(
				resolve,
				Math.min(retryIn * ((retryFactor || 1) ** attempt), retryLimit || Infinity)
			))
		checkAbortSignal(req.signal)
		return retry > attempt
			? await proxy(req, consoleCounter, depth, attempt + 1)
			: await helpResponse(req, HttpStatus.INTERNAL_SERVER_ERROR,
				error?.toString() ?? 'Unknown error'
			)
	}
}

// #endregion
