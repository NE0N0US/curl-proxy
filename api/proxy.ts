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

// #endregion

// #region - data

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
	HEADERS = 'headers',
	DEL_HEADERS = 'delheaders',
	RES_HEADERS = 'resheaders',
	DEL_RES_HEADERS = 'delresheaders',
	SKIP_DEFAULTS = 'skipdefaults',
	STATUS = 'status',
	STATUS_TEXT = 'statustext',
	RETRY = 'retry',
	RETRY_IN = 'retryin',
	TIMEOUT = 'timeout',
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

// #endregion

// #region - help

const HELP_TEXT = 'HELP_TEXT'

let helpHtml

function formatStringArray(array: readonly string[]) {
	return `["${array.join('", "')}"]`
}

function formatStringRecord(record: Record<string, unknown>) {
	return JSON.stringify(record, undefined, ' ').replace(/(?:(?<={)\n )|\n/g, '')
}

/** https://lodash.com/docs/#escape */
function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
}

function formatHelp(message?: string, serviceUrl = 'http://localhost:3000/', html = false) {
	const
		url = new URL(serviceUrl),
		width = Math.max(...Object.values(SearchParam).map(({length}) => length)),
		text = `${message ? message + '\n\n' : ''}` +
			// usage
			`Usage:\n${url.origin}${url.pathname}?` +
			`${SearchParam.URL}=<url>` +
			`[&${SearchParam.HEADERS}=<json_object>]` +
			`[&${SearchParam.DEL_HEADERS}=<json_array>]` +
			`[&${SearchParam.RES_HEADERS}=<json_object>]` +
			`[&${SearchParam.DEL_RES_HEADERS}=<json_array>]` +
			`[&${SearchParam.SKIP_DEFAULTS}]` +
			`[&${SearchParam.STATUS}=<status_code>]` +
			`[&${SearchParam.STATUS_TEXT}=<status_message>]` +
			`[&${SearchParam.RETRY}=<limit=0>]` +
			`[&${SearchParam.RETRY_IN}=<milliseconds=0>]` +
			`[&${SearchParam.TIMEOUT}=<milliseconds=${GLOBAL_TIMEOUT}>]` +
			// url params
			`\n\nURL Parameters:\n` +
			`* ${SearchParam.URL.padEnd(width)} - original resource URL, default protocol is https\n` +
			// headers
			`* ${SearchParam.HEADERS.padEnd(width)} - request headers to overwrite` +
			(isRecord(SearchDefaults.HEADERS, String, 'string') ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.HEADERS, String, 'string') ? `  ${formatStringRecord(SearchDefaults.HEADERS)}\n` : '') +
			// delheaders
			`* ${SearchParam.DEL_HEADERS.padEnd(width)} - names of request headers to delete` +
			(isArray(SearchDefaults.DEL_HEADERS, String) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_HEADERS, String) ? `  ${formatStringArray(SearchDefaults.DEL_HEADERS)}\n` : '') +
			// resheaders
			`* ${SearchParam.RES_HEADERS.padEnd(width)} - response headers to overwrite` +
			(isRecord(SearchDefaults.RES_HEADERS, String, 'string') ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.RES_HEADERS, String, 'string') ? `  ${formatStringRecord(SearchDefaults.RES_HEADERS)}\n` : '') +
			// delresheaders
			`* ${SearchParam.DEL_RES_HEADERS.padEnd(width)} - names of response headers to delete` +
			(isArray(SearchDefaults.DEL_RES_HEADERS, String) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_RES_HEADERS, String) ? `  ${formatStringArray(SearchDefaults.DEL_RES_HEADERS)}\n` : '') +
			// other params
			(`* ${SearchParam.SKIP_DEFAULTS.padEnd(width)} - do not apply default header changes\n`) +
			`* ${SearchParam.STATUS.padEnd(width)} - response status code to overwrite\n` +
			`* ${SearchParam.STATUS_TEXT.padEnd(width)} - response status message to overwrite\n` +
			`* ${SearchParam.RETRY.padEnd(width)} - retries after first request\n` +
			`* ${SearchParam.RETRY_IN.padEnd(width)} - milliseconds between retries\n` +
			`* ${SearchParam.TIMEOUT.padEnd(width)} - milliseconds to abort request after`
	return html ? (helpHtml ??= fileText('templates/help.html'))
		.replace(HELP_TEXT, escapeHtml(text)) : text
}

/** does not use `encodeBody` */
function helpResponse(req: Request, status = HttpStatus.OK, message?: string) {
	const html = resolveAcceptHeader(req.headers.get(Header.ACCEPT),
		[AcceptHeader.HTML], AcceptHeader.ANY) !== AcceptHeader.ANY
	return new Response(formatHelp(message, req.url, html), {
		status,
		headers: html ? {[Header.CONTENT_TYPE]: AcceptHeader.HTML} : undefined,
	})
}

// #endregion

// #region - utils

function fileText(filename: string) {
	return fs.readFileSync(path.join(process.cwd(), filename)).toString()
}

function isArray<T = any>(value: any, ofClass?: Function): value is T[] {
	return Array.isArray(value) && (!ofClass || !!value.length &&
		!value.some(item => item?.constructor.name !== ofClass?.name)
	)
}

function isRecord<K extends keyof any, V = any>(value: any, valuesClass?: Function, keysType?: string): value is Record<K, V> {
	const isObject = typeof value === 'object' && value && !isArray(value)
	if (!isObject)
		return false
	let valuesOfClass = true, keysOfType = true
	if (valuesClass) {
		const values = Object.values(value)
		valuesOfClass = !!values.length && !values.some(value => value?.constructor.name !== valuesClass?.name)
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

// #endregion

// #region - proxy

function resolveAcceptHeader(value: string | null | undefined, allow: readonly string[], fallback: string) {
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

function encodeBody(body: ReadableStream<Uint8Array<ArrayBuffer>> | null, encoding: string): typeof body {
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
	return transform ? stream.Readable.toWeb(stream.Readable.fromWeb(body as any).pipe(transform)) as any : body
}

async function proxy(req: Request, timerSuffix: number, attempt = 0): Promise<Response> {
	const {
		[SearchParam.URL]: url,
		[SearchParam.SKIP_DEFAULTS]: clean,
		...params
	} = Object.fromEntries(new URL(req.url).searchParams)
	const [retry, retryIn] = [SearchParam.RETRY, SearchParam.RETRY_IN].map(key => {
		const param = params[key]
		return (param?.match(/^d+$/) && Number.isSafeInteger(+param) && +param > 0)
			? +param : 0
	})
	if (!url)
		return helpResponse(req, HttpStatus.BAD_REQUEST, `Missing ${SearchParam.URL} parameter!`)
	// get request headers
	const
		reqHeaders = Object.fromEntries(req.headers),
		acceptEncoding = resolveAcceptHeader(reqHeaders[Header.ACCEPT_ENCODING],
			ACCEPT_ENCODING_HEADER_ALL, AcceptEncodingHeader.ANY),
		contentEncoding = acceptEncoding === AcceptEncodingHeader.ANY ? AcceptEncodingHeader.DEFAULT : acceptEncoding
	// delete request headers
	;[
		...clean !== undefined ? [] : SearchDefaults.DEL_HEADERS,
		...tryParse<string[]>(params[SearchParam.DEL_HEADERS], isArray, String) ?? [],
	]
		?.forEach(name => deleteWildcard(reqHeaders, name))
	// overwrite request headers
	Object.assign(reqHeaders,
		clean !== undefined ? [] : lowerKeys(SearchDefaults.HEADERS ?? {}),
		lowerKeys(Object.fromEntries(new Headers(
			tryParse<Record<string, string>>(params[SearchParam.HEADERS], isRecord, String, 'string')
		)))
	)
	try {
		if (!attempt)
			console.time('fetch-' + timerSuffix)
		const
			timeoutParam = params[SearchParam.TIMEOUT],
			timeout = Math.max(0, Number.isSafeInteger(+timeoutParam) ? +timeoutParam : 0),
		// get response
			res = await fetch(url.match(/^\w+:\/\//) ? url : ('https://' + url),
				new Request(retry > attempt ? req.clone() : req, {
					headers: new Headers(reqHeaders),
					signal: timeout ? AbortSignal.timeout(timeout) : undefined,
				})
			),
		// get response headers
			resHeaders: Record<string, string | string[]> = {
				...Object.fromEntries(res.headers),
				[Header.CONTENT_ENCODING]: contentEncoding === AcceptEncodingHeader.IDENTITY ? '' : contentEncoding,
			}
		if (retry === attempt)
			console.timeEnd('fetch-' + timerSuffix)
		// fix response headers: https://github.com/nodejs/undici/issues/2514
		if (resHeaders[Header.CONTENT_ENCODING]) {
			delete resHeaders[Header.CONTENT_LENGTH]
			resHeaders[Header.TRANSFER_ENCODING] = TRANSFER_ENCODING_CHUNKED
		}
		else
			delete resHeaders[Header.CONTENT_ENCODING]
		// get cookies
		if (res.headers.getSetCookie().length)
			resHeaders[Header.SET_COOKIE] = res.headers.getSetCookie()
		// delete response headers
		;[
			...clean !== undefined ? [] : SearchDefaults.DEL_RES_HEADERS,
			...tryParse<string[]>(params[SearchParam.DEL_RES_HEADERS], isArray, String) ?? [],
		]
			?.forEach(name => deleteWildcard(resHeaders, name))
		// overwrite response headers
		Object.assign(resHeaders,
			clean !== undefined ? [] : lowerKeys(SearchDefaults.RES_HEADERS ?? {}),
			lowerKeys(Object.fromEntries(new Headers(
				tryParse<Record<string, string>>(params[SearchParam.RES_HEADERS], isRecord, String, 'string')
			)))
		)
		// set cookies
		const
			headers = new Headers(resHeaders as Record<string, string>),
			cookieHeader = resHeaders[Header.SET_COOKIE]
		if (isArray(cookieHeader, String)) {
			headers.delete(Header.SET_COOKIE)
			cookieHeader.forEach(value => headers.append(Header.SET_COOKIE, value))
		}
		// clone response
		return new Response(encodeBody(res.body, contentEncoding), {
			headers,
			status: +(params[SearchParam.STATUS] || res.status),
			statusText: params[SearchParam.STATUS_TEXT] ?? res.statusText,
		})
	}
	catch (error) {
		console.error(error)
		// retry in
		if (retry > attempt && retryIn)
			await new Promise(resolve => setTimeout(resolve, retryIn))
		return retry > attempt
			? await proxy(req, timerSuffix, ++attempt)
			: helpResponse(req, HttpStatus.INTERNAL_SERVER_ERROR,
				['Error!', error?.toString() ?? ''].filter(part => part).join('\n')
			)
	}
}

let c = 0

export default {
	fetch: async (req: Request) => {
		const n = c++
		console.time('proxy-' + n)
		const res = await proxy(req, n)
		console.timeEnd('proxy-' + n)
		return res
	}
}

// #endregion
