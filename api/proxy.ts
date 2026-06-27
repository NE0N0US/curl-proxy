// #region - imports

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import stream from 'node:stream'
import undici from 'undici'

const GLOBAL_TIMEOUT = 300_000

undici.setGlobalDispatcher(new undici.Agent({
	// https://vercel.com/docs/functions/configuring-functions/duration#duration-limits
	connect: {timeout: GLOBAL_TIMEOUT},
	strictContentLength: false,
}))

enum Filename {
	TEMPLATE_HELP = 'templates/help.html',
	TEMPLATE_MD = 'templates/md.html',
	README_MD = 'README.md',
}

// #endregion

// #region - data

type StringRecord = Record<string, string>

type Bytes = Uint8Array<ArrayBuffer>

type Body = ReadableStream<Bytes> | null | undefined

enum HttpMethod {
	POST = 'POST',
}

enum HttpStatus {
	OK = 200,
	BAD_REQUEST = 400,
	INTERNAL_SERVER_ERROR = 500,
}

enum Header {
	ACCEPT = 'accept',
	CONTENT_TYPE = 'content-type',
	ACCEPT_ENCODING = 'accept-encoding',
	CONTENT_ENCODING = 'content-encoding',
	CONTENT_LENGTH = 'content-length',
	TRANSFER_ENCODING = 'transfer-encoding',
	SET_COOKIE = 'set-cookie',
	X_RESPONSES = 'x-responses',
}

const TRANSFER_ENCODING_CHUNKED = 'chunked'

enum AcceptHeader {
	HTML = 'text/html',
	ANY = '*/*',
}

enum AcceptEncodingHeader {
	DEFAULT = 'gzip',
	GZIP = 'gzip',
	DEFLATE = 'deflate',
	BROTLI = 'br',
	ZSTD = 'zstd',
	IDENTITY = 'identity',
	ANY = '*',
}

const ACCEPT_ENCODING_HEADER_ALL = Object.freeze([
	AcceptEncodingHeader.GZIP,
	AcceptEncodingHeader.DEFLATE,
	AcceptEncodingHeader.BROTLI,
	AcceptEncodingHeader.ZSTD,
	AcceptEncodingHeader.IDENTITY,
	AcceptEncodingHeader.ANY,
])

enum SearchParam {
	URL = 'url',
	FASTEST = 'fastest',
	HEADERS = 'headers',
	DEL_HEADERS = 'delheaders',
	RES_HEADERS = 'resheaders',
	DEL_RES_HEADERS = 'delresheaders',
	SKIP_DEFAULTS = 'skipdefaults',
	METHOD = 'method',
	BODY = 'body',
	STATUS = 'status',
	STATUS_TEXT = 'statustext',
	RETRY = 'retry',
	RETRY_IN = 'retryin',
	TIMEOUT = 'timeout',
	THROTTLE = 'throttle',
}

const SearchDefaults = Object.freeze({
	DEL_HEADERS: Object.freeze([
		// https://developer.mozilla.org/docs/Web/HTTP/Reference/Status/304
		'Cache-Control', 'Pragma', 'If-Modified-Since', 'If-None-Match',
		// proxy address
		'Origin', 'Referer', 'Forwarded', 'X-Forwarded-For', 'X-Forwarded-Host',
	]),
	HEADERS: Object.freeze({
		'Sec-Fetch-Site': 'same-site',
	}),
	DEL_RES_HEADERS: Object.freeze([]),
	RES_HEADERS: Object.freeze({
		'Access-Control-Allow-Origin': '*',
	}),
})

const SERVICE_URL_DEFAULT = 'http://localhost:3000/api/proxy'

const GITHUB_API_MD = 'https://api.github.com/markdown'

const TEMPLATE_CONTENT = 'TEMPLATE_CONTENT'

const THROTTLE_TICK_DEFAULT = 50

const PROTOCOL_DEFAULT = 'https'

// #endregion

// #region - help

function formatHttpHeader(name: string) {
	return name.toLowerCase()
		.replace(/(?<=^|-)\w/g, char => char.toUpperCase())
}

function formatStringArray(array: readonly string[]) {
	return `["${array.join('", "')}"]`
}

function formatStringRecord(record: StringRecord) {
	return JSON.stringify(record, undefined, ' ').replace(/(?:(?<={)\n )|\n/g, '')
}

/** https://lodash.com/docs/#escape */
function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
}

function formatHelp(message?: string, serviceUrl = SERVICE_URL_DEFAULT, html = false) {
	const
		url = new URL(serviceUrl),
		width = Math.max(...Object.values(SearchParam).map(({length}) => length)),
		text = `${message ? `Error:\n${message}\n\n` : ''}` +
			// usage
			`Usage:\n${url.origin}${url.pathname}?` +
			`\n  ${SearchParam.URL}=<url,multi>` +
			`\n  [&${SearchParam.FASTEST}]` +
			`\n  [&${SearchParam.HEADERS}=<json_object>]` +
			`\n  [&${SearchParam.DEL_HEADERS}=<json_array>]` +
			`\n  [&${SearchParam.RES_HEADERS}=<json_object>]` +
			`\n  [&${SearchParam.DEL_RES_HEADERS}=<json_array>]` +
			`\n  [&${SearchParam.SKIP_DEFAULTS}]` +
			`\n  [&${SearchParam.METHOD}=<http_method>]` +
			`\n  [&${SearchParam.BODY}=<body_text>]` +
			`\n  [&${SearchParam.STATUS}=<status_code>]` +
			`\n  [&${SearchParam.STATUS_TEXT}=<status_message>]` +
			`\n  [&${SearchParam.RETRY}=<limit=0>]` +
			`\n  [&${SearchParam.RETRY_IN}=<milliseconds=0>]` +
			`\n  [&${SearchParam.TIMEOUT}=<milliseconds=${GLOBAL_TIMEOUT}>]` +
			`\n  [&${SearchParam.THROTTLE}=<kbps=Infinity>]` +
			// url params
			`\n\nURL Parameters:\n` +
			`* ${
				SearchParam.URL.padEnd(width)
			} - resource URL, default https, repeatable, first response used, others in ${
				formatHttpHeader(Header.X_RESPONSES)
			}\n` +
			`* ${SearchParam.FASTEST.padEnd(width)} - return first completed response, abort others\n` +
			// headers
			`* ${SearchParam.HEADERS.padEnd(width)} - request headers to overwrite` +
			(isRecord(SearchDefaults.HEADERS) ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.HEADERS) ? `  ${formatStringRecord(SearchDefaults.HEADERS)}\n` : '') +
			// delheaders
			`* ${SearchParam.DEL_HEADERS.padEnd(width)} - names of request headers to delete` +
			(isArray(SearchDefaults.DEL_HEADERS) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_HEADERS) ? `  ${formatStringArray(SearchDefaults.DEL_HEADERS)}\n` : '') +
			// resheaders
			`* ${SearchParam.RES_HEADERS.padEnd(width)} - response headers to overwrite` +
			(isRecord(SearchDefaults.RES_HEADERS) ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.RES_HEADERS) ? `  ${formatStringRecord(SearchDefaults.RES_HEADERS)}\n` : '') +
			// delresheaders
			`* ${SearchParam.DEL_RES_HEADERS.padEnd(width)} - names of response headers to delete` +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? `  ${formatStringArray(SearchDefaults.DEL_RES_HEADERS)}\n` : '') +
			// other params
			(`* ${SearchParam.SKIP_DEFAULTS.padEnd(width)} - do not apply default header changes\n`) +
			`* ${SearchParam.METHOD.padEnd(width)} - HTTP method override\n` +
			`* ${SearchParam.BODY.padEnd(width)} - request body text\n` +
			`* ${SearchParam.STATUS.padEnd(width)} - response status code to overwrite\n` +
			`* ${SearchParam.STATUS_TEXT.padEnd(width)} - response status message to overwrite\n` +
			`* ${SearchParam.RETRY.padEnd(width)} - retries after first request\n` +
			`* ${SearchParam.RETRY_IN.padEnd(width)} - milliseconds between retries\n` +
			`* ${SearchParam.TIMEOUT.padEnd(width)} - milliseconds to abort request after\n` +
			`* ${SearchParam.THROTTLE.padEnd(width)} - bandwidth limit in kbit/s`
	return html ? fileText(Filename.TEMPLATE_HELP)
		.replace(TEMPLATE_CONTENT, escapeHtml(text)) : text
}

/** does not use `encodeBody` */
async function helpResponse(req: Request, status = HttpStatus.OK, message?: string) {
	const
		url = new URL(req.url ?? SERVICE_URL_DEFAULT),
		text = (message ? `# Error\n\`\`\`\n${message}\n\`\`\`\n` : '') +
			fileText(Filename.README_MD)
				.replace(SERVICE_URL_DEFAULT, `${url.origin}${url.pathname}`),
		acceptHtml = resolveAcceptHeader(req.headers.get(Header.ACCEPT),
			[AcceptHeader.HTML], AcceptHeader.ANY) !== AcceptHeader.ANY,
		result = acceptHtml ? await fetch(GITHUB_API_MD, {
			method: HttpMethod.POST,
			body: JSON.stringify({text}),
		})
			.then(res => res.text())
			.then(html =>
				fileText(Filename.TEMPLATE_MD).replace(TEMPLATE_CONTENT, html)
			)
			.catch(() => formatHelp(message, req.url, acceptHtml))
			: formatHelp(message, req.url, acceptHtml)
	return new Response(result, {
		status,
		headers: acceptHtml ? {[Header.CONTENT_TYPE]: AcceptHeader.HTML} : undefined,
	})
}

// #endregion

// #region - utils

const fileTextCache: Record<string, string> = {}

function fileText(filename: string) {
	return fileTextCache[filename] ??=
		fs.readFileSync(path.join(process.cwd(), filename)).toString()
}

function isArray<T = any>(value: any, ofClass: Function | undefined = String): value is T[] {
	return Array.isArray(value) && (!ofClass || !!value.length &&
		!value.some(item => item?.constructor.name !== ofClass?.name)
	)
}

function isRecord<K extends keyof any, V = any>(
	value: any,
	valuesClass: Function | undefined = String,
	keysType: string | undefined = 'string'
): value is Record<K, V> {
	const isObject = typeof value === 'object' && value && !isArray(value, undefined)
	if (!isObject)
		return false
	let valuesOfClass = true, keysOfType = true
	if (valuesClass) {
		const values = Object.values(value)
		valuesOfClass = !!values.length && !values.some(value =>
			value?.constructor.name !== valuesClass?.name
		)
		if (!valuesOfClass)
			return false
	}
	if (keysType) {
		const keys = Object.keys(value)
		keysOfType = !!keys.length && !keys.some(key => typeof key !== keysType)
		if (!keysOfType)
			return false
	}
	return valuesOfClass && keysOfType
}

function tryParse<T = any>(json: string, isValid: Function, ...args: any[]) {
	try {
		const value = JSON.parse(json)
		if (isValid(value, ...args))
			return value as T
	}
	catch {}
}

function escapeRegex(text: string) {
	return text.replace(/[\^\$\.\*\+\?\(\)\[\]\{\}\|]/g, char => '\\' + char)
}

function deleteWildcard<T>(record: Record<string, T>, key: string) {
	const regex = new RegExp('^' + key.replace(/./g, char =>
		char === '*' ? '.*' : escapeRegex(char)
	) + '$', 'i')
	Object.keys(record).forEach(key => {
		if (key.match(regex))
			delete record[key]
	})
	return record
}

function lowerKeys<T>(record: Record<string, T>): typeof record {
	return Object.fromEntries(
		Object.entries(record).map(([k, v]) => [k.toLowerCase(), v])
	)
}

function getAbortError(message = 'Aborted') {
	return new DOMException(message, 'AbortError')
}

// #endregion

// #region - proxy

function resolveAcceptHeader(
	value: string | null | undefined,
	allow: readonly string[],
	fallback: string
) {
	const
		items = value
			?.split(/, */g)
			.map(item => {
				const [value, weight] = item.split(';q=')
				return {value, weight: +(weight ?? 1)}
			})
			.filter(({value}) => allow.includes(value)) ?? [],
		maxWeight = Math.max(...items.map(({weight}) => weight))
	return items.find(({weight}) => weight === maxWeight)?.value ?? fallback
}

function trackBody(body: Body, timerSuffix: string): Body {
	let isFirst = true
	return body?.pipeThrough(new TransformStream({
		transform(chunk, controller) {
			if(isFirst)
				console.time(timerSuffix + 'body')
			isFirst = false
			controller.enqueue(chunk)
		},
		flush() {
			console.timeEnd(timerSuffix + 'body')
		},
	}))
}

function encodeBody(body: Body, encoding: string, signal?: AbortSignal): Body {
	if (!body)
		return body
	let transform: stream.Transform | undefined
	switch (encoding) {
		case AcceptEncodingHeader.GZIP:
			transform = zlib.createGzip({level: zlib.constants.Z_BEST_COMPRESSION})
			break
		case AcceptEncodingHeader.DEFLATE:
			transform = zlib.createDeflate({level: zlib.constants.Z_BEST_COMPRESSION})
			break
		case AcceptEncodingHeader.BROTLI:
			transform = zlib.createBrotliCompress()
			break
		case AcceptEncodingHeader.ZSTD:
			transform = zlib.createZstdCompress({params: {
				[zlib.constants.ZSTD_c_compressionLevel]: zlib.constants.ZSTD_btultra2,
			}})
			break
	}
	function abort() {
		transform?.destroy(signal?.reason ?? getAbortError())
	}
	if (signal?.aborted)
		abort()
	signal?.addEventListener('abort', abort, {once: true})
	return transform ? stream.Readable.toWeb(
		stream.Readable.fromWeb(body as any).pipe(transform)
	) as any : body
}

function throttleBody(source: Body, kbps: number, options: Partial<{
	signal: AbortSignal,
	tick: number,
}> = {}): Body {
	if (!source || kbps <= 0)
		return source
	const
		tick = options.tick || THROTTLE_TICK_DEFAULT,
		reader = source.getReader(),
		state = {
			done: false,
			chunks: [] as Bytes[],
			offset: 0,
			aborted: false,
			reason: undefined as any,
		}
	options.signal?.addEventListener('abort', () =>
		Object.assign(state, options.signal),
	{once: true})
	return new ReadableStream<Bytes>({
		cancel(reason) {
			reader.cancel(reason)
		},
		start() {
			(async () => {
				while (!state.done) {
					const chunk = await reader.read()
					state.done = chunk.done
					state.chunks.push(...chunk.value ? [chunk.value] : [])
				}
			})().catch(() => state.done = true)
		},
		async pull(controller) {
			while (!state.done && !state.chunks.length)
				await new Promise(resolve => setTimeout(resolve, 1))
			if (!state.chunks.length)
				return controller.close()
			let tickBytes = Math.round((kbps * 1024) / 8 * tick / 1000)
			while (tickBytes > 0 && state.chunks.length) {
				const
					chunk = state.chunks[0],
					slice = Math.min(tickBytes, chunk.length - state.offset)
				controller.enqueue(
					chunk.subarray(state.offset, state.offset + slice)
				)
				state.offset += slice
				tickBytes -= slice
				if (state.offset === chunk.length) {
					state.chunks.shift()
					state.offset = 0
				}
			}
			await new Promise((resolve, reject) => {
				if (state.aborted)
					reject(state.reason ?? getAbortError())
				else
					setTimeout(resolve, tick)
			})
		},
	})
}

function defaultProtocol(url: string, protocol = PROTOCOL_DEFAULT) {
	return url.match(/^\w+:\/\//) ? url : (protocol + '://' + url)
}

async function proxy(req: Request, timerCounter: number, attempt = 0): Promise<Response> {
	if (req.signal?.aborted)
		throw req.signal.reason ?? getAbortError()
	// parse search params
	const
		searchParams = new URL(req.url).searchParams,
		urls = searchParams.getAll(SearchParam.URL),
		{
			[SearchParam.SKIP_DEFAULTS]: clean,
			[SearchParam.TIMEOUT]: timeoutParam,
			...params
		} = Object.fromEntries(searchParams),
		[status, retry, retryIn, throttle] = [
			SearchParam.STATUS,
			SearchParam.RETRY,
			SearchParam.RETRY_IN,
			SearchParam.THROTTLE,
		].map(key => {
			const param = params[key]
			return (param?.match(/^\d+$/) && Number.isSafeInteger(+param) && +param > 0)
				? +param : 0
		}),
		timeout = Math.max(0, Number.isSafeInteger(+timeoutParam) ? +timeoutParam : 0)
	if (!urls[0])
		return await helpResponse(req, HttpStatus.BAD_REQUEST, `Missing ${SearchParam.URL} parameter`)
	// get request headers
	const
		reqHeaders = Object.fromEntries(req.headers),
		acceptEncoding = resolveAcceptHeader(reqHeaders[Header.ACCEPT_ENCODING],
			ACCEPT_ENCODING_HEADER_ALL, AcceptEncodingHeader.ANY),
		contentEncoding = acceptEncoding === AcceptEncodingHeader.ANY
			? AcceptEncodingHeader.DEFAULT : acceptEncoding
	// delete request headers
	;[
		...clean !== undefined ? [] : SearchDefaults.DEL_HEADERS,
		...tryParse<string[]>(params[SearchParam.DEL_HEADERS], isArray) ?? [],
	]
		?.forEach(name => deleteWildcard(reqHeaders, name))
	// overwrite request headers
	Object.assign(reqHeaders,
		clean !== undefined ? [] : lowerKeys(SearchDefaults.HEADERS ?? {}),
		lowerKeys(Object.fromEntries(new Headers(
			tryParse<StringRecord>(params[SearchParam.HEADERS], isRecord)
		)))
	)
	try {
		const timerPrefix = `[${timerCounter}:${attempt || '*'}] `
		if (!attempt)
			console.time(timerPrefix + 'fetch')
		const
			method = params[SearchParam.METHOD] || req.method,
			request = new Request(req, {
				method,
				body: (method.toUpperCase() === 'GET' ? undefined : params[SearchParam.BODY])
					?? throttleBody((retry > attempt ? req.clone() : req).body, throttle),
				headers: new Headers(reqHeaders),
				signal: AbortSignal.any([
					req.signal,
					...timeout ? [AbortSignal.timeout(timeout)] : [],
				]),
				// @ts-expect-error
				duplex: 'half',
			}),
		// send requests
			requestAborters = urls.map(() => new AbortController()),
			responsePromises = urls.map((url, index) =>
				fetch(defaultProtocol(url), new Request(
					index ? request.clone() : request,
					{
						signal: AbortSignal.any([
							request.signal,
							requestAborters[index].signal,
						]),
					}
				)).then(res => {
					requestAborters.splice(index, 1)
					return res
				})
			),
			responsesPromise = Promise.allSettled(responsePromises)
		// get response(s)
		let
			responses: PromiseSettledResult<Response>[] = [],
			res: Response
		if (params[SearchParam.FASTEST] === undefined) {
			responses = await responsesPromise
			if (responses[0].status === 'rejected')
				throw responses[0].reason
			else
				res = responses[0].value
			responses.shift()
		}
		else {
			res = await Promise.race(responsePromises)
			requestAborters.forEach(aborter => aborter.abort())
		}
		// get response headers
		const resHeaders: Record<string, string | string[]> = {
			...Object.fromEntries(res.headers),
			[Header.CONTENT_ENCODING]:
				contentEncoding === AcceptEncodingHeader.IDENTITY ? '' : contentEncoding,
		}
		if (retry === attempt)
			console.timeEnd(timerPrefix + 'fetch')
		// fix response headers: https://github.com/nodejs/undici/issues/2514
		if (resHeaders[Header.CONTENT_ENCODING]) {
			delete resHeaders[Header.CONTENT_LENGTH]
			resHeaders[Header.TRANSFER_ENCODING] = TRANSFER_ENCODING_CHUNKED
		}
		else
			delete resHeaders[Header.CONTENT_ENCODING]
		// add extra responses header
		if (responses.length)
			resHeaders[Header.X_RESPONSES] = JSON.stringify(
				responses.map(result =>
					result.status === 'fulfilled' ? result.value.status : null
				)
			)
		// get cookies
		if (res.headers.getSetCookie().length)
			resHeaders[Header.SET_COOKIE] = res.headers.getSetCookie()
		// delete response headers
		;[
			...clean !== undefined ? [] : SearchDefaults.DEL_RES_HEADERS,
			...tryParse<string[]>(params[SearchParam.DEL_RES_HEADERS], isArray) ?? [],
		]
			?.forEach(name => deleteWildcard(resHeaders, name))
		// overwrite response headers
		Object.assign(resHeaders,
			clean !== undefined ? [] : lowerKeys(SearchDefaults.RES_HEADERS ?? {}),
			lowerKeys(Object.fromEntries(new Headers(
				tryParse<StringRecord>(params[SearchParam.RES_HEADERS], isRecord)
			)))
		)
		// set cookies
		const
			headers = new Headers(resHeaders as StringRecord),
			cookieHeader = resHeaders[Header.SET_COOKIE]
		if (isArray(cookieHeader)) {
			headers.delete(Header.SET_COOKIE)
			cookieHeader.forEach(value => headers.append(Header.SET_COOKIE, value))
		}
		// clone response
		return new Response(
			trackBody(
				encodeBody(
					throttleBody(res.body, throttle),
					contentEncoding,
					req.signal
				),
				timerPrefix
			),
		{
			headers,
			status: status || res.status,
			statusText: params[SearchParam.STATUS_TEXT] ?? res.statusText,
		})
	}
	catch (error) {
		console.error(error)
		// retry in
		if (retry > attempt && retryIn)
			await new Promise(resolve => setTimeout(resolve, retryIn))
		if (req.signal?.aborted)
			throw req.signal.reason ?? getAbortError()
		return retry > attempt
			? await proxy(req, timerCounter, ++attempt)
			: await helpResponse(req, HttpStatus.INTERNAL_SERVER_ERROR,
				error?.toString() ?? 'Unknown error'
			)
	}
}

let c = 0

export default {
	fetch: async (req: Request) => {
		req.signal?.addEventListener('abort', () =>
			console.debug(`[${n}:*] abort`),
		{once: true})
		const n = c++
		console.time(`[${n}:*] proxy`)
		return await proxy(req, n).finally(() =>
			console.timeEnd(`[${n}:*] proxy`)
		)
	}
}

// #endregion
