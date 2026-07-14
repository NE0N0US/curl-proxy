import {ProxyConfig, ProxyConfigVercel} from '../types.ts'
import {escapeHtml, fileText, formatStringArray, formatStringRecord, isArray, isRecord} from '../utils.ts'
import {AcceptHeader, Header, HttpMethod, HttpStatus, AUTHORIZATION_BEARER, PROTOCOL_DEFAULT, formatHttpHeader, resolveAcceptHeader} from '../http.ts'

import {SearchParam} from './params.ts'
import {ResBodyParam} from './body.ts'
import {SearchDefaults} from './headers.ts'

// #region - data

enum Filename {
	TEMPLATE_HELP = 'src/templates/help.html',
	TEMPLATE_MD = 'src/templates/md.html',
	TEMPLATE_MD_CACHED_HTML = 'src/templates/cache/md-cached.html',
	README_MD = 'README.md',
}

const TEMPLATE_CONTENT = 'TEMPLATE_CONTENT'

// #endregion

// #region - functions

function formatHelp(message: string | undefined, config: ProxyConfig, html = false) {
	const
		width = Math.max(...Object.values(SearchParam).map(({length}) => length)),
		widthRbp = Math.max(...Object.values(ResBodyParam).map(({length}) => length)),
		text = `${message ? `Error:\n${message}\n\n` : ''}` +
			// description
			`cURL Proxy:` +
			`\ncURL Proxy is an unauthenticated, non-caching, Node.js HTTP(S) proxy that supports batch requests and is driven by URL query. Headers, methods, bodies, and status codes can be overridden, and headers can also be deleted using wildcards. Responses can be transformed through custom JavaScript logic, which can chain requests and merge responses. It also supports retries with exponential backoff, timeouts, throttling and optional limits on request batching and recursion. By default it strips sensitive request headers and bypasses CORS response restrictions, useful for debugging and development.` +
			// server
			`\n\nServer:` +
			`\n- Public instance - https://curl-proxy.vercel.app/?url=… or https://vercel.com/new/clone?repository-url=https://github.com/NE0N0US/curl-proxy` +
			`\n- Local instance  - npm start` +
			`\n- CLI instance    - npx -y @ne0n0us/curl-proxy` +
			// library
			`\n\nLibrary:` +
			`\nimport {createProxy} from '@ne0n0us/curl-proxy'\nconst proxy = createProxy(config)\nconst response = await proxy(request)` +
			// url params
			`\n\nURL Parameters:` +
			`\n* ${
				SearchParam.URL.padEnd(width)
			} - resource URL, ${
				PROTOCOL_DEFAULT
			} assumed, required, repeatable (max. ${
				config.urlCountMax
			}), first response used, other statuses in JSON ${
				formatHttpHeader(Header.X_PROXY_RESPONSES)
			}` +
			`\n* ${SearchParam.FASTEST.padEnd(width)} - return first available response, abort others` +
			// headers
			`\n* ${
				SearchParam.HEADERS.padEnd(width)
			} - request headers to overwrite (${
				formatHttpHeader(Header.HOST)
			} is determined dynamically)` +
			(isRecord(SearchDefaults.HEADERS) ? ', in addition to:' : '') +
			(isRecord(SearchDefaults.HEADERS) ? `\n  ${formatStringRecord(SearchDefaults.HEADERS)}` : '') +
			// delheaders
			`\n* ${
				SearchParam.DEL_HEADERS.padEnd(width)
			} - names of request headers to delete (${
				formatHttpHeader(Header.CONNECTION)
			} is deleted along with headers listed in it, * is a wildcard)` +
			(isArray(SearchDefaults.DEL_HEADERS) ? ', in addition to:' : '') +
			(isArray(SearchDefaults.DEL_HEADERS) ? `\n  ${formatStringArray(SearchDefaults.DEL_HEADERS)}` : '') +
			// resheaders
			`\n* ${
				SearchParam.RES_HEADERS.padEnd(width)
			} - response headers to overwrite (${
				formatHttpHeader(Header.AC_EXPOSE_HEADERS)
			} is set automatically)` +
			(isRecord(SearchDefaults.RES_HEADERS) ? ', in addition to:' : '') +
			(isRecord(SearchDefaults.RES_HEADERS) ? `\n  ${formatStringRecord(SearchDefaults.RES_HEADERS)}` : '') +
			// delresheaders
			`\n* ${SearchParam.DEL_RES_HEADERS.padEnd(width)} - names of response headers to delete (${
				formatHttpHeader(Header.CONNECTION)
			} is deleted along with headers listed in it, * is a wildcard)` +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? ', in addition to:' : '') +
			(isArray(SearchDefaults.DEL_RES_HEADERS) ? `\n  ${formatStringArray(SearchDefaults.DEL_RES_HEADERS)}` : '') +
			// other params
			(`\n* ${
				SearchParam.SKIP_DEFAULTS.padEnd(width)
			} - do not apply default header changes, except response safety behavior and setting response ${
				formatHttpHeader(Header.X_PROXY_RECURSION)
			} (max. ${config.proxyRecursionMax})`) +
			`\n* ${SearchParam.METHOD.padEnd(width)} - request method override` +
			`\n* ${SearchParam.BODY.padEnd(width)} - request body text` +
			// resbody
			`\n* ${SearchParam.RES_BODY.padEnd(width)} - response transformation:` +
			`\n  * ${ResBodyParam.NULL.padEnd(widthRbp + 1)} - remove response body` +
			`\n  * ${ResBodyParam.ATOB.padEnd(widthRbp + 1)} - decode body from base64` +
			`\n  * ${ResBodyParam.BTOA.padEnd(widthRbp + 1)} - encode body to base64` +
			`\n  * ${ResBodyParam.JAVASCRIPT}… - custom handler, returns body, response or request` +
			// other params
			`\n* ${SearchParam.STATUS.padEnd(width)} - response status code to overwrite` +
			`\n* ${SearchParam.STATUS_TEXT.padEnd(width)} - response status message to overwrite` +
			`\n* ${SearchParam.RETRY.padEnd(width)} - retries after first request` +
			`\n* ${SearchParam.RETRY_IN.padEnd(width)} - milliseconds between retries, supports exponential backoff:` +
			`\n  min(in * (factor ^ attempt), limit)` +
			`\n* ${SearchParam.RETRY_FACTOR.padEnd(width)} - backoff multiplier per retry (industry standard is 2)` +
			`\n* ${SearchParam.RETRY_LIMIT.padEnd(width)} - backoff maximum milliseconds` +
			`\n* ${SearchParam.TIMEOUT.padEnd(width)} - milliseconds to abort request after` +
			`\n* ${SearchParam.TTFB.padEnd(width)} - milliseconds to first response byte` +
			`\n* ${SearchParam.THROTTLE.padEnd(width)} - bidirectional bandwidth limit in kbit/s` +
			`\n* ${SearchParam.THROTTLE_UP.padEnd(width)} - upload bandwidth limit in kbit/s` +
			// response headers safety
			`\n\nResponse Headers Safety:` +
			`\n// https://github.com/nodejs/undici/issues/2514\nif (headers.get('Content-Encoding')) {\n  headers.delete('Content-Encoding')\n  headers.delete('Content-Length')\n}\n// recompress\nconst contentEncoding = resolveAcceptHeader(headers.get('Accept-Encoding')) || 'gzip'\nif (contentEncoding !== 'identity') {\n  headers.set('Content-Encoding', contentEncoding)\n  headers.delete('Content-Length')\n  headers.set('Transfer-Encoding', 'chunked')\n}\n// resbody param\nif (['null', 'atob', 'btoa'].includes(params.get('resbody')?.toLowerCase()))\n  headers.delete('Content-Length')` +
			`\n\nAfter running resbody custom handler:` +
			`\nif (!result instanceof Request && !result instanceof Response && result !== undefined)\n  headers.delete('Content-Length')` +
			// typescript declaration of resbody javascript
			`\n\nTypeScript Declaration of "resbody=javascript:…":` +
			`\ndeclare function custom(\n  // request with parameters applied\n  req: RequestView,\n  // first or fastest response with parameters applied\n  res: ResponseView,\n  // other responses, null if error\n  responses: Array<ResponseView | null>\n): CustomResult\ninterface ReqResView {\n  url: string\n  headers: Record<string, string>\n  // body:\n  body: ReadableStream | null\n  bytes: Uint8Array\n  text: string\n  json: any\n}\ninterface RequestView extends ReqResView {\n  method: string\n}\ninterface ResponseView extends ReqResView {\n  cookies: string[]\n  ok: boolean\n  redirected: boolean\n  status: number\n  statusText: string\n}\ntype CustomResult =\n  | Request                     // replace original request and refetch response\n  | Response                    // replace original response\n  | undefined                   // return original response\n  | ReadableStream | Uint8Array // replace response body with value\n  | unknown                     // replace response body with coerced value?.toString()\n  | null                        // remove response body`
	return html ? fileText(Filename.TEMPLATE_HELP)
		.replace(TEMPLATE_CONTENT, escapeHtml(text)) : text
}

async function formatHelpMd(message: string | undefined, config: ProxyConfigVercel) {
	if (!message)
		try {
			return fileText(Filename.TEMPLATE_MD_CACHED_HTML)
		}
		catch {}
	const text = (message ? `# Error\n\`\`\`\n${message}\n\`\`\`\n` : '') + fileText(Filename.README_MD)
	return await fetch(config.githubApiMd, {
		method: HttpMethod.POST,
		headers: new Headers({
			[Header.ACCEPT]: AcceptHeader.HTML,
			[Header.X_GH_API_VERSION]: config.githubApiVer,
			...config.githubApiToken ? {
				[Header.AUTHORIZATION]: AUTHORIZATION_BEARER + config.githubApiToken,
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
export async function helpResponse(req: Request, config: ProxyConfigVercel, status = HttpStatus.OK, message?: string) {
	const
		acceptHtml = config.allowHelpHtml && resolveAcceptHeader(req.headers.get(Header.ACCEPT),
			[AcceptHeader.HTML], AcceptHeader.ANY) !== AcceptHeader.ANY,
		result = acceptHtml ? await formatHelpMd(message, config)
			.catch(() => formatHelp(message, config, acceptHtml))
			: formatHelp(message, config, acceptHtml)
	return new Response(result, {
		status,
		headers: {
			...acceptHtml ? {[Header.CONTENT_TYPE]: AcceptHeader.HTML} : {},
			...SearchDefaults.RES_HEADERS,
		},
	})
}

// #endregion
