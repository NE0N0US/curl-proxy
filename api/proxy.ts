// #region - env

const PROXY_RECURSION_MAX = +(process.env.PROXY_RECURSION_MAX || 64)

// https://vercel.com/docs/functions/configuring-functions/duration#duration-limits
const GLOBAL_TIMEOUT = +(process.env.GLOBAL_TIMEOUT || 300_000)

// #endregion

// #region - imports

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import stream from 'node:stream'
import vm from 'node:vm'
import undici from 'undici'

undici.setGlobalDispatcher(new undici.Agent({
	connect: {timeout: GLOBAL_TIMEOUT},
	headersTimeout: GLOBAL_TIMEOUT,
	bodyTimeout: GLOBAL_TIMEOUT,
	keepAliveMaxTimeout: GLOBAL_TIMEOUT,
	strictContentLength: false,
	allowH2: true,
	autoSelectFamily: true,
	maxHeaderSize: 2 ** 16,
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
	GET = 'GET',
	HEAD = 'HEAD',
	POST = 'POST',
}

enum HttpStatus {
	OK = 200,
	BAD_REQUEST = 400,
	INTERNAL_SERVER_ERROR = 500,
	LOOP_DETECTED = 508,
}

enum Header {
	ACCEPT = 'accept',
	CONTENT_TYPE = 'content-type',
	ACCEPT_ENCODING = 'accept-encoding',
	CONTENT_ENCODING = 'content-encoding',
	CONTENT_LENGTH = 'content-length',
	TRANSFER_ENCODING = 'transfer-encoding',
	CONNECTION = 'Connection',
	HOST = 'Host',
	SET_COOKIE = 'set-cookie',
	X_RESPONSES = 'x-responses',
	X_PROXY_RECURSION = 'x-proxy-recursion',
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
	RES_BODY = 'resbody',
	STATUS = 'status',
	STATUS_TEXT = 'statustext',
	RETRY = 'retry',
	RETRY_IN = 'retryin',
	RETRY_FACTOR = 'retryfactor',
	RETRY_LIMIT = 'retrylimit',
	TIMEOUT = 'timeout',
	THROTTLE = 'throttle',
}

const SearchDefaults = Object.freeze({
	DEL_HEADERS: Object.freeze([
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
		'Connection', 'Keep-Alive', 'Proxy-Authenticate', 'Proxy-Authorization',
		'Trailer', 'Transfer-Encoding', 'TE', 'Upgrade',
		// https://developer.mozilla.org/docs/Web/HTTP/Reference/Status/304
		'Cache-Control', 'Pragma', 'If-Modified-Since', 'If-None-Match',
		// real addresses
		'Origin', 'Referer', 'Via', 'Forwarded', 'X-Forwarded-*', '*-IP',
		// browser data
		'Sec-CH-*', 'Sec-Fetch-*',
		// for Access-Control-Allow-Origin
		'Access-Control-Allow-Credentials',
	]),
	HEADERS: Object.freeze({}),
	DEL_RES_HEADERS: Object.freeze([]),
	RES_HEADERS: Object.freeze({
		'Access-Control-Allow-Origin': '*',
	}),
})

enum ResBodyParam {
	NULL = 'null',
	ATOB = 'atob',
	BTOA = 'btoa',
	JAVASCRIPT = 'javascript:',
}

const SERVICE_URL_DEFAULT = 'http://localhost:3000/api/proxy'

const GITHUB_API_MD = 'https://api.github.com/markdown'

const TEMPLATE_CONTENT = 'TEMPLATE_CONTENT'

const THROTTLE_TICK_DEFAULT = 50

const PROTOCOL_DEFAULT = 'http'

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
		url = new URL(defaultProtocol(serviceUrl)),
		width = Math.max(...Object.values(SearchParam).map(({length}) => length)),
		widthRbp = Math.max(...Object.values(ResBodyParam).map(({length}) => length)),
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
			`\n  [&${SearchParam.RES_BODY}=<action>]` +
			`\n  [&${SearchParam.STATUS}=<status_code>]` +
			`\n  [&${SearchParam.STATUS_TEXT}=<status_message>]` +
			`\n  [&${SearchParam.RETRY}=<limit=0>]` +
			`\n  [&${SearchParam.RETRY_IN}=<milliseconds=0>]` +
			`\n  [&${SearchParam.RETRY_FACTOR}=<number=1>]` +
			`\n  [&${SearchParam.RETRY_LIMIT}=<milliseconds=Infinity>]` +
			`\n  [&${SearchParam.TIMEOUT}=<milliseconds=${GLOBAL_TIMEOUT}>]` +
			`\n  [&${SearchParam.THROTTLE}=<kbps=Infinity>]` +
			// url params
			`\n\nURL Parameters:\n` +
			`* ${
				SearchParam.URL.padEnd(width)
			} - resource URL, default ${
				PROTOCOL_DEFAULT
			}, repeatable, first response used, others in ${
				formatHttpHeader(Header.X_RESPONSES)
			}\n` +
			`* ${SearchParam.FASTEST.padEnd(width)} - return first completed response, abort others\n` +
			// headers
			`* ${SearchParam.HEADERS.padEnd(width)} - request headers to overwrite (Host is determined dynamically)` +
			(isRecord(SearchDefaults.HEADERS) ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.HEADERS) ? `  ${formatStringRecord(SearchDefaults.HEADERS)}\n` : '') +
			// delheaders
			`* ${SearchParam.DEL_HEADERS.padEnd(width)} - names of request headers to delete (Connection is deleted along with headers listed in it, * is a wildcard)` +
			(isArray(SearchDefaults.DEL_HEADERS) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_HEADERS) ? `  ${formatStringArray(SearchDefaults.DEL_HEADERS)}\n` : '') +
			// resheaders
			`* ${SearchParam.RES_HEADERS.padEnd(width)} - response headers to overwrite` +
			(isRecord(SearchDefaults.RES_HEADERS) ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.RES_HEADERS) ? `  ${formatStringRecord(SearchDefaults.RES_HEADERS)}\n` : '') +
			// delresheaders
			`* ${SearchParam.DEL_RES_HEADERS.padEnd(width)} - names of response headers to delete (* is a wildcard)` +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? `  ${formatStringArray(SearchDefaults.DEL_RES_HEADERS)}\n` : '') +
			// other params
			(`* ${
				SearchParam.SKIP_DEFAULTS.padEnd(width)
			} - do not apply default header changes, except safety behavior and setting ${
				formatHttpHeader(Header.X_PROXY_RECURSION)
			} (maximum ${PROXY_RECURSION_MAX})\n`) +
			`* ${SearchParam.METHOD.padEnd(width)} - HTTP method override\n` +
			`* ${SearchParam.BODY.padEnd(width)} - request body text\n` +
			// resbody
			`* ${SearchParam.RES_BODY.padEnd(width)} - response transformation:\n` +
			`  * ${ResBodyParam.NULL.padEnd(widthRbp + 1)} - remove response body\n` +
			`  * ${ResBodyParam.ATOB.padEnd(widthRbp + 1)} - decode body from base64\n` +
			`  * ${ResBodyParam.BTOA.padEnd(widthRbp + 1)} - encode body to base64\n` +
			`  * ${ResBodyParam.JAVASCRIPT}… - custom handler, returns body, response or request\n` +
			// other params
			`* ${SearchParam.STATUS.padEnd(width)} - response status code to overwrite\n` +
			`* ${SearchParam.STATUS_TEXT.padEnd(width)} - response status message to overwrite\n` +
			`* ${SearchParam.RETRY.padEnd(width)} - retries after first request\n` +
			`* ${SearchParam.RETRY_IN.padEnd(width)} - milliseconds between retries, supports exponential backoff:\n` +
			`  min(in * (factor ^ attempt), limit)\n` +
			`* ${SearchParam.RETRY_FACTOR.padEnd(width)} - backoff multiplier per retry\n` +
			`* ${SearchParam.RETRY_LIMIT.padEnd(width)} - backoff maximum milliseconds\n` +
			`* ${SearchParam.TIMEOUT.padEnd(width)} - milliseconds to abort request after\n` +
			`* ${SearchParam.THROTTLE.padEnd(width)} - bandwidth limit in kbit/s` +
			// headers safety behavior
			`\n\nHeaders Safety Behavior\n` +
			`// https://github.com/nodejs/undici/issues/2514\nif (headers.get('Content-Encoding')) {\n  headers.delete('Content-Encoding')\n  headers.delete('Content-Length')\n}\n// recompress\nconst contentEncoding = resolveAcceptHeader(headers.get('Accept-Encoding')) || 'gzip'\nif (contentEncoding !== 'identity') {\n  headers.set('Content-Encoding', contentEncoding)\n  headers.delete('Content-Length')\n  headers.set('Transfer-Encoding', 'chunked')\n}\n// resbody param\nif (['null', 'atob', 'btoa'].includes(params.get('resbody')?.toLowerCase()))\n  headers.delete('Content-Length')` +
			`\n\nAfter running resbody custom handler\n` +
			`if (!result instanceof Request && !result instanceof Response && result !== undefined)\n  headers.delete('Content-Length')` +
			// typescript declaration of resbody javascript
			`\n\nTypeScript Declaration of "resbody=javascript:*"\n` +
			`declare function custom(\n  // request with parameters applied\n  req: RequestView,\n  // first or fastest response with parameters applied\n  res: ResponseView,\n  // other responses, null if error\n  responses: Array<ResponseView | null>\n): CustomResult\ninterface ReqResView {\n  url: string\n  headers: Record<string, string>\n  // body:\n  bytes: Uint8Array\n  text: string\n  json: any\n}\ninterface RequestView extends ReqResView {\n  method: string\n}\ninterface ResponseView extends ReqResView {\n  cookies: string[]\n  ok: boolean\n  redirected: boolean\n  status: number\n  statusText: string\n}\ntype CustomResult =\n  | Request                     // replace original request and refetch response\n  | Response                    // replace original response\n  | undefined                   // return original response\n  | ReadableStream | Uint8Array // replace response body with value\n  | unknown                     // replace response body with coerced value?.toString()\n  | null                        // remove response body`
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
			.then(res => {
				if (!res.ok)
					throw new Error(`${res.status} ${res.statusText}`)
				return res
			})
			.then(res => res.text())
			.then(html =>
				fileText(Filename.TEMPLATE_MD).replace(
					TEMPLATE_CONTENT,
					html.replaceAll('href="#', 'href="#user-content-')
				)
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

function tryParse<T = any>(json: string | null | undefined, isValid: Function, ...args: any[]) {
	if (!json)
		return undefined
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

function deleteHeadersWildcard(headers: Headers, key: string) {
	const regex = new RegExp('^' + key.replace(/./g, char =>
		char === '*' ? '.*' : escapeRegex(char)
	) + '$', 'i')
	headers.keys().forEach(key => {
		if (key.match(regex))
			while (headers.has(key))
				headers.delete(key)
	})
	return headers
}

function getAbortError(message = 'Aborted') {
	return new DOMException(message, 'AbortError')
}

function checkAbortSignal(signal?: AbortSignal, message?: string) {
	if (signal?.aborted)
		throw signal.reason ?? getAbortError(message)
}

/** decode base64 */
function atobStream() {
	let leftover = ''
	return new stream.Transform({
		transform(chunk, _encoding, callback) {
			let text = leftover + chunk.toString('ascii')
			if (/\s/.test(text))
				text = text.replace(/\s+/g, '')
			const length = text.length - (text.length % 4)
			if (length > 0)
				this.push(Buffer.from(text.slice(0, length), 'base64'))
			leftover = text.slice(length)
			callback()
		},
		flush(callback) {
			if (leftover.length)
				this.push(Buffer.from(leftover, 'base64'))
			callback()
		},
	})
}

/** encode base64 */
function btoaStream() {
	let leftover = Buffer.alloc(0)
	return new stream.Transform({
		transform(chunk, _encoding, callback) {
			chunk = Buffer.concat([leftover, chunk])
			const length = chunk.length - (chunk.length % 3)
			if (length > 0)
				this.push(chunk.subarray(0, length).toString('base64'))
			leftover = chunk.subarray(length)
			callback()
		},
		flush(callback) {
			if (leftover.length)
				this.push(leftover.toString('base64'))
			callback()
		},
	})
}

/** single chunk */
function streamify(value: Bytes | string | null | undefined) {
	return value === null || value === undefined ? value : new ReadableStream<Bytes>({
		start(controller) {
			controller.enqueue(
				value instanceof Uint8Array ? value : new TextEncoder().encode(value)
			)
			controller.close()
		},
	})
}

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

function defaultProtocol(url: string, protocol = PROTOCOL_DEFAULT) {
	return url.match(/^\w+:\/\//) ? url : (protocol + '://' + url)
}

// #endregion

// #region - proxy

function parseParams(searchParams: URLSearchParams) {
	const
		{
			[SearchParam.RES_BODY]: resbody,
			[SearchParam.TIMEOUT]: timeoutParam,
			...params
		} = Object.fromEntries(searchParams),
		[status, retry, retryIn, retryFactor, retryLimit, throttle] = [
			SearchParam.STATUS,
			SearchParam.RETRY,
			SearchParam.RETRY_IN,
			SearchParam.RETRY_FACTOR,
			SearchParam.RETRY_LIMIT,
			SearchParam.THROTTLE,
		].map(key => {
			const param = params[key]
			return (param?.match(/^\d+$/) && Number.isSafeInteger(+param) && +param > 0)
				? +param : 0
		}),
		doRunCustom = resbody?.startsWith(ResBodyParam.JAVASCRIPT),
		timeout = Math.max(0, Number.isSafeInteger(+timeoutParam) ? +timeoutParam : 0)
	return {params, resbody, status, retry, retryIn, retryFactor, retryLimit, throttle, doRunCustom, timeout}
}

function parseRecursionHeader(headers: Headers, fallback = 0) {
	const recursionParam = headers.get(Header.X_PROXY_RECURSION)?.split(',')[0]!
	return Number.isSafeInteger(+recursionParam) && +recursionParam >= 0
		? +recursionParam : fallback
}

/** `Connection` is deleted along with headers listed in it */
function delSetHeaders(headers: Headers, params: URLSearchParams) {
	const connection = headers.get(Header.CONNECTION)
	;[
		...params.get(SearchParam.SKIP_DEFAULTS) !== null
			? [] : SearchDefaults.DEL_HEADERS ?? [],
		...tryParse<string[]>(params.get(SearchParam.DEL_HEADERS), isArray) ?? [],
	]
		?.forEach(name => deleteHeadersWildcard(headers, name))
	if (connection && !headers.get(Header.CONNECTION))
		connection.split(',').map(name => name.trim())
			.forEach(name => deleteHeadersWildcard(headers, name))
	Object.entries({
		...params.get(SearchParam.SKIP_DEFAULTS) !== null
			? {} : SearchDefaults.HEADERS,
		...tryParse<StringRecord>(params.get(SearchParam.HEADERS), isRecord)
	})
		.forEach(([name, value]) => headers.set(name, value as string))
	return headers
}

/** body is chunked and length is unknown */
function processResHeaders(headers: Headers, params: URLSearchParams, contentEncoding: string) {
	// fix headers: https://github.com/nodejs/undici/issues/2514
	if (headers.get(Header.CONTENT_ENCODING)) {
		headers.delete(Header.CONTENT_ENCODING)
		headers.delete(Header.CONTENT_LENGTH)
	}
	// recompress
	if (contentEncoding !== AcceptEncodingHeader.IDENTITY) {
		headers.set(Header.CONTENT_ENCODING, contentEncoding)
		headers.delete(Header.CONTENT_LENGTH)
		headers.set(Header.TRANSFER_ENCODING, TRANSFER_ENCODING_CHUNKED)
	}
	// resbody param
	if ([ResBodyParam.NULL, ResBodyParam.ATOB, ResBodyParam.BTOA]
		.includes(params.get(SearchParam.RES_BODY)?.toLowerCase() as ResBodyParam)
	)
		headers.delete(Header.CONTENT_LENGTH)
	// delete headers
	;[
		...params.get(SearchParam.SKIP_DEFAULTS) !== null ? []
			: SearchDefaults.DEL_RES_HEADERS ?? [],
		...tryParse<string[]>(params.get(SearchParam.DEL_RES_HEADERS), isArray) ?? [],
	]
		?.forEach(name => deleteHeadersWildcard(headers, name))
	// overwrite headers
	Object.entries({
		...params.get(SearchParam.SKIP_DEFAULTS) !== null
			? {} : SearchDefaults.RES_HEADERS,
		...tryParse<StringRecord>(params.get(SearchParam.RES_HEADERS), isRecord)
	})
		.forEach(([name, value]) => headers.set(name, value as string))
	return headers
}

async function fetchMulti(request: Request, params: URLSearchParams) {
	// send requests
	const
		urls = params.getAll(SearchParam.URL)
			.map(url => defaultProtocol(url)),
		requestAborters = urls.map(() => new AbortController()),
		responsePromises = urls.map((url, index) => {
			const headers = request.headers
			if (params.get(SearchParam.SKIP_DEFAULTS) === null)
				headers.set(Header.HOST, new URL(url).host)
			return fetch(url, new Request(
				urls.length > 1 || params.get(SearchParam.RES_BODY)
					?.startsWith(ResBodyParam.JAVASCRIPT) ? request.clone() : request,
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
		res = await Promise.race(responsePromises)
		requestAborters.forEach(aborter => aborter.abort())
	}
	return {res, responses}
}

async function runCustom(
	req: Request, res: Response, responses: Array<Response | null>, code: string, timeout = 10_000
): Promise<Request | Response | Body | Bytes | unknown> {
	let reqText, reqJson
	const
		[resView, ...responsesViews] = await Promise.all([res, ...responses].map(async res => {
			if (!res)
				return res
			let resText, resJson
			const view = {
				bytes: !res.body ? new Uint8Array() : await res.bytes(),
				get text() {
					return resText ??= new TextDecoder().decode(view.bytes)
				},
				set text(text) {
					resText = text
				},
				get json() {
					return resJson ??= JSON.parse(view.text)
				},
				set json(json) {
					resJson = json
				},
				headers: Object.fromEntries(res.headers),
				cookies: res.headers.getSetCookie(),
				ok: res.ok,
				redirected: res.redirected,
				status: res.status,
				statusText: res.statusText,
				url: res.url,
			}
			return view
		})),
		input = {
			req: {
				bytes: !req.body ? new Uint8Array() : await new Response(req.body).bytes(),
				get text() {
					return reqText ??= new TextDecoder().decode(input.req.bytes)
				},
				set text(text) {
					reqText = text
				},
				get json() {
					return reqJson ??= JSON.parse(input.req.text)
				},
				set json(json) {
					reqJson = json
				},
				headers: Object.fromEntries(req.headers),
				method: req.method,
				url: req.url,
			},
			res: resView!,
			responses: responsesViews,
			Request,
			Response,
		}
	return vm.runInNewContext(code, input, {timeout, breakOnSigint: true})
}

async function processCustom(
	req: Request, res: Response, responses: Array<Response | null>,
	state: {request?: Request, body?: Body} & ResponseInit,
	code: string | undefined
) {
	if (code === undefined)
		return state
	const result = await runCustom(
		req,
		new Response(res.body, state),
		responses,
		code
	)
	checkAbortSignal(req.signal)
	let deleteContentLength
	if (result instanceof Request)
		state.request = result
	if (result instanceof Response)
		Object.assign(state, result)
	else if (result instanceof ReadableStream || result === null) {
		state.body = result
		deleteContentLength = true
	}
	else if (result instanceof Uint8Array) {
		state.body = streamify(result as Uint8Array<ArrayBuffer>)
		deleteContentLength = true
	}
	else if(result !== undefined) {
		state.body = streamify(result?.toString())
		deleteContentLength = true
	}
	if (deleteContentLength)
		(state.headers as Headers).delete(Header.CONTENT_LENGTH)
	return state
}

function trackBody(body: Body, consolePrefix: string): Body {
	let isFirst = true
	return body?.pipeThrough(new TransformStream({
		transform(chunk, controller) {
			if(isFirst)
				console.time(consolePrefix + 'body')
			isFirst = false
			controller.enqueue(chunk)
		},
		flush() {
			console.timeEnd(consolePrefix + 'body')
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

function throttleBody(body: Body, kbps: number, options: Partial<{
	signal: AbortSignal,
	tick: number,
}> = {}): Body {
	if (!body || kbps <= 0)
		return body
	const
		tick = options.tick || THROTTLE_TICK_DEFAULT,
		reader = body.getReader(),
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

function transformBody(body: Body, transform: string | undefined, signal?: AbortSignal): Body {
	if (!transform)
		return body
	const fn = transform.toLowerCase()
	if (fn === ResBodyParam.NULL)
		return null
	else if (([
		ResBodyParam.ATOB,
		ResBodyParam.BTOA,
	] as string[]).includes(fn)) {
		if (!body)
			return body
		const transformStream = fn === ResBodyParam.ATOB
			? atobStream() : btoaStream()
		function abort() {
			transformStream?.destroy(signal?.reason ?? getAbortError())
		}
		if (signal?.aborted)
			abort()
		signal?.addEventListener('abort', abort, {once: true})
		return stream.Readable.toWeb(
			stream.Readable.fromWeb(body as any).pipe(transformStream)
		) as any
	}
	return body
}

async function proxy(req: Request, consoleCounter = 0, depth = 0, attempt = 0): Promise<Response> {
	checkAbortSignal(req.signal)
	const
		searchParams = new URL(req.url).searchParams,
		{params, resbody, status, retry, retryIn, retryFactor, retryLimit, throttle, doRunCustom, timeout} =
			parseParams(searchParams),
		consolePrefix = `[${consoleCounter || '*'}:${depth || '*'}:${attempt || '*'}] `
	let recursion = parseRecursionHeader(req.headers)
	if (recursion > PROXY_RECURSION_MAX)
		return await helpResponse(req, HttpStatus.LOOP_DETECTED,
			`Proxy recursion limit of ${PROXY_RECURSION_MAX} exceeded`
		)
	if (!searchParams.get(SearchParam.URL))
		return await helpResponse(req, HttpStatus.BAD_REQUEST, `Missing ${SearchParam.URL} parameter`)
	try {
		// modify request
		const
			method = (params[SearchParam.METHOD] || req.method).toUpperCase(),
			newReq = new Request(req, {
				method,
				body: ([HttpMethod.GET, HttpMethod.HEAD].includes(method as HttpMethod)
					? undefined : streamify(params[SearchParam.BODY]))
					?? throttleBody(
						(retry > attempt ? req.clone() : req).body,
						throttle
					),
				headers: delSetHeaders(req.headers, searchParams),
				signal: AbortSignal.any([
					req.signal,
					...timeout ? [AbortSignal.timeout(timeout)] : [],
				]),
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
			resHeaders.set(Header.X_RESPONSES, JSON.stringify(
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
		if (request)
			request.headers.set(Header.X_PROXY_RECURSION, (recursion + 1)?.toString())
		// processCustom can return headers from new Response
		newResInit.headers = new Headers(newResInit.headers)
		newResInit.headers.set(Header.X_PROXY_RECURSION, (recursion + 1)?.toString())
		// pipe response
		return request ? await proxy(request, consoleCounter, depth + 1, 0) : new Response(
			trackBody(
				encodeBody(
					throttleBody(
						transformBody(newResBody, resbody, req.signal),
						throttle
					),
					contentEncoding,
					req.signal
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

let c = 0

export default {
	fetch: async (req: Request) => {
		const n = c++, consolePrefix = `[${n || '*'}:*:*] `
		req.signal?.addEventListener('abort', () =>
			console.debug(consolePrefix + 'abort'),
		{once: true})
		// console.log(`${consolePrefix}headers:\n${
		// 	JSON.stringify(Object.fromEntries(req.headers), undefined, '\t')
		// 		.replaceAll(',\n\t', '\n')
		// 		.slice(3, -2)
		// }`)
		console.time(consolePrefix + 'proxy')
		return await proxy(req, n).finally(() =>
			console.timeEnd(consolePrefix + 'proxy')
		)
	}
}

// #endregion
