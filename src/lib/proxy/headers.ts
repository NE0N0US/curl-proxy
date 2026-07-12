import {StringRecord} from '../types'
import {isArray, isRecord, tryParse} from '../utils'
import {AcceptEncodingHeader, Header, AC_EXPOSE_HEADERS_SAFELIST, TRANSFER_ENCODING_CHUNKED, deleteHeadersWildcard, formatHttpHeader} from '../http'

import {SearchParam} from './params'
import {ResBodyParam} from './body'

// #region - data

export const SearchDefaults = Object.freeze({
	DEL_HEADERS: Object.freeze([
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
		'Connection', 'Keep-Alive', 'Proxy-Authorization', 'Trailer', 'Transfer-Encoding', 'TE', 'Upgrade',
		// https://developer.mozilla.org/docs/Web/HTTP/Reference/Status/304
		'Cache-Control', 'Pragma', 'If-Modified-Since', 'If-None-Match',
		// real addresses
		'Origin', 'Referer', 'Via', 'Forwarded', 'X-Forwarded-*', '*-IP',
		// browser data
		'Sec-CH-*', 'Sec-Fetch-*',
	]),
	HEADERS: Object.freeze({}),
	DEL_RES_HEADERS: Object.freeze([
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
		'Connection', 'Keep-Alive', 'Proxy-Authenticate', 'Trailer', 'Transfer-Encoding', 'Upgrade',
		// for Access-Control-Allow-Origin
		'Access-Control-Allow-Credentials',
	]),
	RES_HEADERS: Object.freeze({
		'Access-Control-Allow-Origin': '*',
	}),
})

// #endregion

// #region - functions

export function parseRecursionHeader(headers: Headers, fallback = 0) {
	const recursionParam = headers.get(Header.X_PROXY_RECURSION)?.split(',')[0]!
	return (Number.isSafeInteger(+recursionParam) && +recursionParam >= 0)
		? +recursionParam : fallback
}

/** `Connection` is deleted along with headers listed in it */
export function processReqHeaders(headers: Headers, params: URLSearchParams) {
	const
		skipDefaults = params.get(SearchParam.SKIP_DEFAULTS) !== null,
		connection = headers.get(Header.CONNECTION)
	;[
		...skipDefaults ? [] : SearchDefaults.DEL_HEADERS ?? [],
		...tryParse<string[]>(params.get(SearchParam.DEL_HEADERS), isArray) ?? [],
	]
		?.forEach(name => deleteHeadersWildcard(headers, name))
	if (connection && !headers.get(Header.CONNECTION))
		connection.split(',').map(name => name.trim())
			.forEach(name => deleteHeadersWildcard(headers, name))
	Object.entries({
		...skipDefaults ? {} : SearchDefaults.HEADERS,
		...tryParse<StringRecord>(params.get(SearchParam.HEADERS), isRecord)
	})
		.forEach(([name, value]) => headers.set(name, value as string))
	return headers
}

/** `Connection` is deleted along with headers listed in it, body is chunked and length is unknown */
export function processResHeaders(headers: Headers, params: URLSearchParams, contentEncoding: string) {
	const
		skipDefaults = params.get(SearchParam.SKIP_DEFAULTS) !== null,
		connection = headers.get(Header.CONNECTION)
	let setContentEncoding = false
	// safety behavior
	if (headers.get(Header.CONTENT_ENCODING)) {
		headers.delete(Header.CONTENT_ENCODING)
		headers.delete(Header.CONTENT_LENGTH)
	}
	if (contentEncoding !== AcceptEncodingHeader.IDENTITY) {
		setContentEncoding = true
		headers.delete(Header.CONTENT_LENGTH)
	}
	if ([ResBodyParam.NULL, ResBodyParam.ATOB, ResBodyParam.BTOA]
		.includes(params.get(SearchParam.RES_BODY)?.toLowerCase() as ResBodyParam)
	)
		headers.delete(Header.CONTENT_LENGTH)
	// delete headers
	if (!skipDefaults)
		headers.set(Header.AC_EXPOSE_HEADERS, '')
	;[
		...skipDefaults ? [] : SearchDefaults.DEL_RES_HEADERS ?? [],
		...tryParse<string[]>(params.get(SearchParam.DEL_RES_HEADERS), isArray) ?? [],
	]
		?.forEach(name => deleteHeadersWildcard(headers, name))
	if (connection && !headers.get(Header.CONNECTION))
		connection.split(',').map(name => name.trim())
			.forEach(name => deleteHeadersWildcard(headers, name))
	if (setContentEncoding) {
		headers.set(Header.CONTENT_ENCODING, contentEncoding)
		headers.set(Header.TRANSFER_ENCODING, TRANSFER_ENCODING_CHUNKED)
	}
	const acExposeHeadersDeleted = !headers.has(Header.AC_EXPOSE_HEADERS)
	if (!skipDefaults)
		headers.delete(Header.AC_EXPOSE_HEADERS)
	// overwrite headers
	Object.entries({
		...skipDefaults ? {} : SearchDefaults.RES_HEADERS,
		...tryParse<StringRecord>(params.get(SearchParam.RES_HEADERS), isRecord)
	})
		.forEach(([name, value]) => headers.set(name, value as string))
	// expose headers
	if (!skipDefaults && !acExposeHeadersDeleted && !headers.has(Header.AC_EXPOSE_HEADERS))
		headers.set(
			Header.AC_EXPOSE_HEADERS,
			[Header.AC_EXPOSE_HEADERS, ...headers.keys()]
				.filter(key => !AC_EXPOSE_HEADERS_SAFELIST.includes(key.toLowerCase()))
				.sort()
				.map(formatHttpHeader)
				.join(', ')
		)
	return headers
}

// #endregion
