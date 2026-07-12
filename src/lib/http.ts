import {Bytes, StringRecord} from './types'
import {escapeRegex} from './utils'

// #region - data

export const PROTOCOL_DEFAULT = 'http'

/** only utilized */
export enum AcceptHeader {
	HTML = 'text/html',
	ANY = '*/*',
}

export enum AcceptEncodingHeader {
	DEFAULT = 'gzip',
	GZIP = 'gzip',
	DEFLATE = 'deflate',
	BROTLI = 'br',
	ZSTD = 'zstd',
	IDENTITY = 'identity',
	ANY = '*',
}

export const ACCEPT_ENCODING_HEADER_ALL = Object.freeze([
	AcceptEncodingHeader.GZIP,
	AcceptEncodingHeader.DEFLATE,
	AcceptEncodingHeader.BROTLI,
	AcceptEncodingHeader.ZSTD,
	AcceptEncodingHeader.IDENTITY,
	AcceptEncodingHeader.ANY,
])

export const TRANSFER_ENCODING_CHUNKED = 'chunked'

export const AC_EXPOSE_HEADERS_SAFELIST = Object.freeze([
	'cache-control',
	'content-language',
	'content-length',
	'content-type',
	'expires',
	'last-modified',
	'pragma',
])

export const AUTHORIZATION_BEARER = 'Bearer '

/** only utilized */
export enum Header {
	// accept
	ACCEPT = 'accept',
	CONTENT_TYPE = 'content-type',
	ACCEPT_ENCODING = 'accept-encoding',
	CONTENT_ENCODING = 'content-encoding',
	CONTENT_LENGTH = 'content-length',
	TRANSFER_ENCODING = 'transfer-encoding',
	// dynamic
	CONNECTION = 'connection',
	HOST = 'host',
	AC_EXPOSE_HEADERS = 'access-control-expose-headers',
	SET_COOKIE = 'set-cookie',
	X_PROXY_RESPONSES = 'x-proxy-responses',
	X_PROXY_RECURSION = 'x-proxy-recursion',
	// rest auth
	AUTHORIZATION = 'authorization',
	RETRY_AFTER = 'retry-after',
	X_RATELIMIT_REMAINING = 'x-ratelimit-remaining',
	X_GH_API_VERSION = 'x-github-api-version',
}

const HEADER_NAME_EXCEPTION: Readonly<StringRecord> = Object.freeze({
	'www-authenticate': 'WWW-Authenticate',
	'etag': 'ETag',
	'expect-ct': 'Expect-CT',
	'x-xss-protection': 'X-XSS-Protection',
	'te': 'TE',
	'accept-ch': 'Accept-CH',
	'critical-ch': 'Critical-CH',
	'dpr': 'DPR',
	'ect': 'ECT',
	'rtt': 'RTT',
	'dictionary-id': 'Dictionary-ID',
	'dnt': 'DNT',
	'sec-gpc': 'Sec-GPC',
	'nel': 'NEL',
	'x-dns-prefetch-control': 'X-DNS-Prefetch-Control',
	'sec-ch-ua': 'Sec-CH-UA',
	'sec-ch-ua-wow64': 'Sec-CH-UA-WoW64',
	'sec-ch-dpr': 'Sec-CH-DPR',
})

/** only utilized */
export enum HttpMethod {
	GET = 'GET',
	HEAD = 'HEAD',
	POST = 'POST',
}

/** only utilized */
export enum HttpStatus {
	OK = 200,
	BAD_REQUEST = 400,
	INTERNAL_SERVER_ERROR = 500,
	LOOP_DETECTED = 508,
}

// #endregion

// #region - functions

/** relative (starting with `/`, `./`, `../`, `?`, `#`), whole absolute or absolute without protocol */
export function resolveUrl(url: string, base: string, protocol = PROTOCOL_DEFAULT) {
	const isRelative = url.startsWith('/') ||
		url.startsWith('./') ||
		url.startsWith('../') ||
		url.startsWith('?') ||
		url.startsWith('#')
	return isRelative ? new URL(url, base).href :
		url.match(/^\w+:\/\//) ? url : (protocol + '://' + url)
}

/** allowed value with max [q-factor](https://developer.mozilla.org/en-US/docs/Glossary/Quality_values) or fallback */
export function resolveAcceptHeader(
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

export function formatHttpHeader(name: string) {
	const
		lower = name.toLowerCase(),
		exception = HEADER_NAME_EXCEPTION[lower]
	return exception ? exception : lower
		.replace(/(?<=^|-)\w/g, char => char.toUpperCase())
		.replace(/^(Sec-Websocket-)(.+)/, (...args) => 'Sec-WebSocket-' + args[2])
		.replace(/^(Sec-Ch-Ua-)(.+)/, (...args) => 'Sec-CH-UA-' + args[2])
		.replace(/^(Sec-Ch-)(.+)/, (...args) => 'Sec-CH-' + args[2])
}

/** `*` is a wildcard */
export function deleteHeadersWildcard(headers: Headers, key: string) {
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

/** single chunk */
export function streamify(value: Bytes | string | null | undefined) {
	return (value === null || value === undefined) ? value : new ReadableStream<Bytes>({
		start(controller) {
			controller.enqueue(
				value instanceof Uint8Array ? value : new TextEncoder().encode(value)
			)
			controller.close()
		},
	})
}

// #endregion
