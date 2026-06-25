// #region - imports

import fs from 'fs'
import path from 'path'

// #endregion

// #region - data

enum HttpStatus {
	OK = 200,
	BAD_REQUEST = 400,
	INTERNAL_SERVER_ERROR = 500,
}

enum SearchParam {
	URL = 'url',
	HEADERS = 'headers',
	DEL_HEADERS = 'delheaders',
	RES_HEADERS = 'resheaders',
	DEL_RES_HEADERS = 'delresheaders',
	SKIP_DEFAULTS = 'skipdefaults',
	STATUS = 'status',
	STATUS_TEXT = 'statustext',
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
	DEL_RES_HEADERS: Object.freeze([
		// proxy sends raw decoded body, except Deno: https://docs.deno.com/runtime/fundamentals/http_server/#automatic-body-compression
		'Content-Encoding',
	]),
	RES_HEADERS: Object.freeze({
		'Access-Control-Allow-Origin': '*',
	}),
})

const COOKIE_HEADER = 'set-cookie'

// #endregion

// #region - help

let helpHtml

function formatStringArray(array: string[]) {
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
			`[&${SearchParam.TIMEOUT}=<milliseconds>]` +
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
			`* ${SearchParam.TIMEOUT.padEnd(width)} - milliseconds to abort request after`
	return html ? (helpHtml ??= fileText('templates/help.html'))
		.replace('HELP_TEXT', escapeHtml(text)) : text
}

function helpResponse(req: Request, status = HttpStatus.OK, message?: string) {
	const html = req.headers.get('accept')?.includes('text/html')
	return new Response(formatHelp(message, req.url, html), {
		status,
		headers: html ? {'Content-Type': 'text/html'} : undefined,
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

async function proxy(req: Request, timerSuffix: number) {
	const {
		[SearchParam.URL]: url,
		[SearchParam.SKIP_DEFAULTS]: clean,
		...params
	} = Object.fromEntries(new URL(req.url).searchParams)
	if (!url)
		return helpResponse(req, HttpStatus.BAD_REQUEST, `Missing ${SearchParam.URL} parameter!`)
	// get request headers
	const reqHeaders = Object.fromEntries(req.headers)
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
		console.time('fetch-' + timerSuffix)
		const
			timeoutParam = params[SearchParam.TIMEOUT],
			timeout = Math.max(0, Number.isSafeInteger(+timeoutParam) ? +timeoutParam : 0),
		// get response
			res = await fetch(url.match(/^\w+:\/\//) ? url : ('https://' + url), new Request(req, {
				headers: new Headers(reqHeaders),
				signal: timeout ? AbortSignal.timeout(timeout) : undefined,
			})),
		// get response headers
			resHeaders: Record<string, string | string[]> = Object.fromEntries(res.headers)
		console.timeEnd('fetch-' + timerSuffix)
		// get cookies
		if (res.headers.getSetCookie().length)
			resHeaders[COOKIE_HEADER] = res.headers.getSetCookie()
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
		const headers = new Headers(resHeaders as Record<string, string>)
		if (isArray(resHeaders[COOKIE_HEADER], String)) {
			headers.delete(COOKIE_HEADER)
			resHeaders[COOKIE_HEADER].forEach(value => headers.append(COOKIE_HEADER, value))
		}
		// clone response
		return new Response(res.body, {
			headers,
			status: +(params[SearchParam.STATUS] || res.status),
			statusText: params[SearchParam.STATUS_TEXT] ?? res.statusText,
		})
	}
	catch (error) {
		console.error(error)
		return helpResponse(req, HttpStatus.INTERNAL_SERVER_ERROR,
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
