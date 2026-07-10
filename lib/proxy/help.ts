import {GITHUB_API_MD, GITHUB_API_TOKEN, GITHUB_API_VER, GLOBAL_TIMEOUT, PROXY_RECURSION_MAX, URL_COUNT_MAX} from '../env'
import {escapeHtml, fileText, formatStringArray, formatStringRecord, isArray, isRecord} from '../utils'
import {AcceptHeader, Header, HttpMethod, HttpStatus, AUTHORIZATION_BEARER, PROTOCOL_DEFAULT, formatHttpHeader, resolveAcceptHeader, resolveUrl} from '../http'

import {SearchParam} from './params'
import {ResBodyParam} from './body'
import {SearchDefaults} from './headers'

// #region - data

enum Filename {
	TEMPLATE_HELP = 'templates/help.html',
	TEMPLATE_MD = 'templates/md.html',
	TEMPLATE_MD_CACHED_HTML = 'templates/cache/md-cached.html',
	README_MD = 'README.md',
}

const SERVICE_URL_DEFAULT = 'http://localhost:2077/'

const TEMPLATE_CONTENT = 'TEMPLATE_CONTENT'

// #endregion

// #region - functions

function formatHelp(message?: string, serviceUrl = SERVICE_URL_DEFAULT, html = false) {
	const
		url = new URL(resolveUrl(serviceUrl, serviceUrl)),
		width = Math.max(...Object.values(SearchParam).map(({length}) => length)),
		widthRbp = Math.max(...Object.values(ResBodyParam).map(({length}) => length)),
		text = `${message ? `Error:\n${message}\n\n` : ''}` +
			// description
			`cURL Proxy:\n` +
			`cURL Proxy is an unauthenticated, non-caching, Node.js HTTP(S) proxy that supports batch requests and is driven by URL query. Headers, methods, bodies, and status codes can be overridden, and headers can also be deleted using wildcards. Responses can be transformed through custom JavaScript logic, which can chain requests and merge responses. It also supports retries with exponential backoff, timeouts, throttling and optional limits on request batching and recursion. By default it strips sensitive request headers and bypasses CORS response restrictions, useful for debugging and development.\n\n` +
			// usage
			`Usage:\n${url.origin}${url.pathname}?` +
			`${SearchParam.URL}=<url,multi>` +
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
			`\n  [&${SearchParam.THROTTLE_UP}=<kbps=Infinity>]` +
			// url params
			`\n\nURL Parameters:\n` +
			`* ${
				SearchParam.URL.padEnd(width)
			} - resource URL, ${
				PROTOCOL_DEFAULT
			} assumed, required, repeatable (max. ${
				URL_COUNT_MAX
			}), first response used, others in ${
				formatHttpHeader(Header.X_PROXY_RESPONSES)
			}\n` +
			`* ${SearchParam.FASTEST.padEnd(width)} - return first available response, abort others\n` +
			// headers
			`* ${
				SearchParam.HEADERS.padEnd(width)
			} - request headers to overwrite (${
				formatHttpHeader(Header.HOST)
			} is determined dynamically)` +
			(isRecord(SearchDefaults.HEADERS) ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.HEADERS) ? `  ${formatStringRecord(SearchDefaults.HEADERS)}\n` : '') +
			// delheaders
			`* ${
				SearchParam.DEL_HEADERS.padEnd(width)
			} - names of request headers to delete (${
				formatHttpHeader(Header.CONNECTION)
			} is deleted along with headers listed in it, * is a wildcard)` +
			(isArray(SearchDefaults.DEL_HEADERS) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_HEADERS) ? `  ${formatStringArray(SearchDefaults.DEL_HEADERS)}\n` : '') +
			// resheaders
			`* ${
				SearchParam.RES_HEADERS.padEnd(width)
			} - response headers to overwrite (${
				formatHttpHeader(Header.AC_EXPOSE_HEADERS)
			} is set automatically)` +
			(isRecord(SearchDefaults.RES_HEADERS) ? ', in addition to:\n' : '\n') +
			(isRecord(SearchDefaults.RES_HEADERS) ? `  ${formatStringRecord(SearchDefaults.RES_HEADERS)}\n` : '') +
			// delresheaders
			`* ${SearchParam.DEL_RES_HEADERS.padEnd(width)} - names of response headers to delete (${
				formatHttpHeader(Header.CONNECTION)
			} is deleted along with headers listed in it, * is a wildcard)` +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? ', in addition to:\n' : '\n') +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? `  ${formatStringArray(SearchDefaults.DEL_RES_HEADERS)}\n` : '') +
			// other params
			(`* ${
				SearchParam.SKIP_DEFAULTS.padEnd(width)
			} - do not apply default header changes, except response safety behavior and setting response ${
				formatHttpHeader(Header.X_PROXY_RECURSION)
			} (max. ${PROXY_RECURSION_MAX})\n`) +
			`* ${SearchParam.METHOD.padEnd(width)} - request method override\n` +
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
			`* ${SearchParam.RETRY_FACTOR.padEnd(width)} - backoff multiplier per retry (industry standard is 2)\n` +
			`* ${SearchParam.RETRY_LIMIT.padEnd(width)} - backoff maximum milliseconds\n` +
			`* ${SearchParam.TIMEOUT.padEnd(width)} - milliseconds to abort request after\n` +
			`* ${SearchParam.THROTTLE.padEnd(width)} - bidirectional bandwidth limit in kbit/s\n` +
			`* ${SearchParam.THROTTLE_UP.padEnd(width)} - upload bandwidth limit in kbit/s` +
			// response headers safety
			`\n\nResponse Headers Safety\n` +
			`// https://github.com/nodejs/undici/issues/2514\nif (headers.get('Content-Encoding')) {\n  headers.delete('Content-Encoding')\n  headers.delete('Content-Length')\n}\n// recompress\nconst contentEncoding = resolveAcceptHeader(headers.get('Accept-Encoding')) || 'gzip'\nif (contentEncoding !== 'identity') {\n  headers.set('Content-Encoding', contentEncoding)\n  headers.delete('Content-Length')\n  headers.set('Transfer-Encoding', 'chunked')\n}\n// resbody param\nif (['null', 'atob', 'btoa'].includes(params.get('resbody')?.toLowerCase()))\n  headers.delete('Content-Length')` +
			`\n\nAfter running resbody custom handler\n` +
			`if (!result instanceof Request && !result instanceof Response && result !== undefined)\n  headers.delete('Content-Length')` +
			// typescript declaration of resbody javascript
			`\n\nTypeScript Declaration of "resbody=javascript:*"\n` +
			`declare function custom(\n  // request with parameters applied\n  req: RequestView,\n  // first or fastest response with parameters applied\n  res: ResponseView,\n  // other responses, null if error\n  responses: Array<ResponseView | null>\n): CustomResult\ninterface ReqResView {\n  url: string\n  headers: Record<string, string>\n  // body:\n  bytes: Uint8Array\n  text: string\n  json: any\n}\ninterface RequestView extends ReqResView {\n  method: string\n}\ninterface ResponseView extends ReqResView {\n  cookies: string[]\n  ok: boolean\n  redirected: boolean\n  status: number\n  statusText: string\n}\ntype CustomResult =\n  | Request                     // replace original request and refetch response\n  | Response                    // replace original response\n  | undefined                   // return original response\n  | ReadableStream | Uint8Array // replace response body with value\n  | unknown                     // replace response body with coerced value?.toString()\n  | null                        // remove response body` +
			`\n\nExtra. Notes\n` +
			`* Escape complex parameters (${SearchParam.URL}, ${SearchParam.BODY}, "${SearchParam.RES_BODY}=${ResBodyParam.JAVASCRIPT}…") using tools like https://www.postman.com/\n` +
			`* Additional ${SearchParam.URL} along with ${SearchParam.SKIP_DEFAULTS} can be used to debug requests using services like https://webhook.site/\n` +
			`* You can debug requests and get fake responses in https://httpbin.org/ and https://jsonplaceholder.typicode.com/\n` +
			`* You can edit JSON objects and arrays in visual editors (https://dataformatterpro.com/json-editor/) and should minify it (https://jsonlint.com/json-minify)\n` +
			`* Both ${SearchParam.URL} count and recursion level are limited for performance and security reasons\n` +
			`* HTTP reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference\n` +
			`* Default response header changes allow bypassing CORS restrictions on request origin and response headers\n` +
			`* ${SearchParam.RES_BODY} custom handlers support most of ES2025 (https://test262.fyi/#|qjs), crypto object and following Web APIs:\n` +
			`  * URL\n  * URLSearchParams\n  * FormData\n  * Headers\n  * Request\n  * Response\n  * Blob\n  * TextEncoder\n  * TextDecoder\n  * ReadableStream\n  * WritableStream\n  * TransformStream\n  * DecompressionStream\n  * CompressionStream\n` +
			'* Common mobile network speed, kbit/s:\n' +
			`  | Type | Download | Upload |\n  | 3G   |      384 |    256 |\n  | H    |    7 000 |  2 000 |\n  | H+   |   12 000 |  5 000 |\n  | 4G   |   50 000 | 15 000 |\n  | 4G+  |  100 000 | 40 000 |\n` +
			`* You can ask DeepWiki (https://deepwiki.com/NE0N0US/curl-proxy) about this project`
	return html ? fileText(Filename.TEMPLATE_HELP)
		.replace(TEMPLATE_CONTENT, escapeHtml(text)) : text
}

async function formatHelpMd(url = SERVICE_URL_DEFAULT, message?: string) {
	const {origin, pathname} = new URL(url), serviceUrl = `${origin}${pathname}`
	if (!message)
		try {
			const
				text = fileText(Filename.TEMPLATE_MD_CACHED_HTML),
				index = text.lastIndexOf(SERVICE_URL_DEFAULT)
			return text.slice(0, index) + serviceUrl + text.slice(index + serviceUrl.length)
		}
		catch {}
	const text = (message ? `# Error\n\`\`\`\n${message}\n\`\`\`\n` : '') +
		fileText(Filename.README_MD)
			.replace(SERVICE_URL_DEFAULT, serviceUrl)
	return await fetch(GITHUB_API_MD, {
		method: HttpMethod.POST,
		headers: new Headers({
			[Header.ACCEPT]: AcceptHeader.HTML,
			[Header.X_GH_API_VERSION]: GITHUB_API_VER,
			...GITHUB_API_TOKEN ? {
				[Header.AUTHORIZATION]: AUTHORIZATION_BEARER + GITHUB_API_TOKEN,
			} : {},
		}),
		body: JSON.stringify({text}),
	})
		.then(res => {
			if (!res.ok)
				throw new Error(`${res.status} ${res.statusText}`)
			else if (res.headers.has(Header.RETRY_AFTER) ||
				res.headers.get(Header.X_RATELIMIT_REMAINING) === '0'
			)
				throw new Error('Rate limit error')
			return res
		})
		.then(res => res.text())
		.then(html =>
			fileText(Filename.TEMPLATE_MD).replace(
				TEMPLATE_CONTENT,
				html.replaceAll('href="#', 'href="#user-content-')
			)
		)
}

/** neither streamed nor compressed */
export async function helpResponse(req: Request, status = HttpStatus.OK, message?: string) {
	const
		acceptHtml = resolveAcceptHeader(req.headers.get(Header.ACCEPT),
			[AcceptHeader.HTML], AcceptHeader.ANY) !== AcceptHeader.ANY,
		result = acceptHtml ? await formatHelpMd(req.url, message)
			.catch(() => formatHelp(message, req.url, acceptHtml))
			: formatHelp(message, req.url, acceptHtml)
	return new Response(result, {
		status,
		headers: {
			...acceptHtml ? {[Header.CONTENT_TYPE]: AcceptHeader.HTML} : {},
			...SearchDefaults.RES_HEADERS,
		},
	})
}

// #endregion

