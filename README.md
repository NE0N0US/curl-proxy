# qURL Proxy [![& qURL Artisan](https://badgen.net/static/client/qURL%20Artisan?icon=chrome)](https://qurl-proxy.vercel.app/qurl-artisan?open=about)
**qURL Proxy** is an unauthenticated, non-caching, Node.js **HTTP(S) proxy** that supports batch requests and is [driven by URL query](#url-parameters). Headers, methods, bodies, and status codes can be overridden, and headers can also be deleted using wildcards. Responses can be transformed through *[custom JavaScript logic](#typescript-declaration-of-resbodyjavascript)*, which can chain requests and merge responses. *It also supports* retries with exponential backoff, timeouts, throttling and optional limits on request batching and recursion. By default it strips sensitive request headers and *bypasses CORS* response restrictions, useful for debugging and development. <sub>[Notes](#notes-) · [Examples](https://qurl-proxy.vercel.app/qurl-artisan?open=examples)</sub>

# Usage [![](https://badgen.net/npm/node/qurl-proxy?icon=nodedotjs)](https://nodejs.org/en/download)
## Server [![](https://badgen.net/packagephobia/install/qurl-proxy?icon=packagephobia)](https://packagephobia.com/result?p=qurl-proxy)
- Public instance - `https://qurl-proxy.vercel.app/?url=…` or [clone](https://vercel.com/new/clone?repository-url=https://github.com/NE0N0US/qurl-proxy)
- Local instance - `npm start`
- CLI instance (no client) - `npx -y qurl-proxy`

## Library [![](https://badgen.net/packagephobia/publish/qurl-proxy?icon=packagephobia)](https://packagephobia.com/result?p=qurl-proxy)
```javascript
import {createProxy} from 'qurl-proxy'
const proxy = createProxy(config)
const response = await proxy(request)
```

## URL Parameters
- `url` - resource URL, `http` assumed, *required*, *repeatable* (max. `16`), first response used, other statuses in comma-separated `X-Proxy-Responses`
- `fastest` - return first available response and its index in `X-Proxy-Responses`, abort others
- `headers` - JSON or JSONCrush object of request headers to overwrite (`Host` is determined dynamically)
- `delheaders` - JSON or JSONCrush array of names of request headers to delete (`Connection` is deleted along with headers listed in it, `*` is a wildcard), in addition to:
  ```jsonc
  [
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
    "Connection", "Keep-Alive", "Proxy-Authorization", "Trailer", "Transfer-Encoding", "TE", "Upgrade",
    // https://developer.mozilla.org/docs/Web/HTTP/Reference/Status/304
    "Cache-Control", "Pragma", "If-Modified-Since", "If-None-Match",
    // real addresses
    "Origin", "Referer", "Via", "Forwarded", "X-Forwarded-*", "*-IP",
    // browser data
    "Sec-CH-*", "Sec-Fetch-*",
  ]
  ```
- `resheaders` - JSON or JSONCrush object of response headers to overwrite (`Access-Control-Allow-Origin` and `Access-Control-Expose-Headers` are set automatically), in addition to:
  ```json
  {
    "Access-Control-Allow-Headers": "*",
	"Access-Control-Allow-Credentials": "true",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*"
  }
  ```
- `delresheaders` - JSON or JSONCrush array of names of response headers to delete (`Connection` is deleted along with headers listed in it, `*` is a wildcard), in addition to:
  ```jsonc
  [
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
    "Connection", "Keep-Alive", "Proxy-Authenticate", "Trailer", "Transfer-Encoding", "Upgrade",
  ]
   ```
- `renresheaders` - rename response headers to `X-Original-*` before changes
- `skipdefaults` - do not apply default header changes, except [response safety behavior](#response-headers-safety) and setting response `X-Proxy-Recursion` (max. `16`)
- `method` - request method override
- `body` - request body text
- `resbody` - response transformation:
  - `null` - remove response body
  - `atob` - decode body from Base64
  - `btoa` - encode body to Base64
  - `javascript:…` - [custom handler](#typescript-declaration-of-resbodyjavascript), returns body, response or request
- `status` - response status code to overwrite
- `retry` - retries after first request
- `retryin` - milliseconds between retries, supports exponential backoff:\
  *min*(*in* * *factor*<sup>*attempt*</sup>, *limit*)
- `retryfactor` - backoff multiplier per retry (default is `1`, industry standard is `2`)
- `retrylimit` - backoff maximum milliseconds
- `timeout` - milliseconds to abort request after (default is `300000`)
- `ttfb` - milliseconds to first response byte
- `throttle` - bidirectional bandwidth limit in kbit/s
- `throttleup` - upload bandwidth limit in kbit/s

## Response Headers Safety
```typescript
// https://github.com/nodejs/undici/issues/2514
if (headers.get('Content-Encoding')) {
  headers.delete('Content-Encoding')
  headers.delete('Content-Length')
}
// recompress
const contentEncoding = resolveAcceptHeader(headers.get('Accept-Encoding')) || 'gzip'
if (contentEncoding !== 'identity') {
  headers.set('Content-Encoding', contentEncoding)
  headers.delete('Content-Length')
  headers.set('Transfer-Encoding', 'chunked')
}
// resbody param
if (['null', 'atob', 'btoa'].includes(params.get('resbody')?.toLowerCase()))
  headers.delete('Content-Length')
```
### After running `resbody` [custom handler](#typescript-declaration-of-resbodyjavascript)
```typescript
if (!result instanceof Request && !result instanceof Response && result !== undefined)
  headers.delete('Content-Length')
```

## TypeScript Declaration of `resbody=javascript:…`
```typescript
declare function custom(
  // request with parameters applied
  req: RequestView,
  // first or fastest response with parameters applied
  res: ResponseView,
  // other responses, null if error
  responses: Array<ResponseView | null>
): CustomResult

interface ReqResView {
  url: string
  headers: Record<string, string>
  // body:
  body: ReadableStream | null
  bytes: Uint8Array
  text: string
  json: any
}

interface RequestView extends ReqResView {
  method: string
}

interface ResponseView extends ReqResView {
  cookies: string[]
  ok: boolean
  redirected: boolean
  status: number
  statusText: string
}

type CustomResult =
  | Request                     // replace original request and refetch response
  | Response                    // replace original response
  | undefined                   // return original response
  | ReadableStream | Uint8Array // replace response body with value
  | unknown                     // replace response body with coerced value?.toString()
  | null                        // remove response body
```

## Notes [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/NE0N0US/qurl-proxy)
- Keep entire URL under deployment platform limit, [14 KB for Vercel](https://vercel.com/docs/errors/url_too_long)
- [Escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) complex parameters (`url`, `body`, `resbody=javascript:…`)
- `resbody` custom handlers support [most of ES2025](https://test262.fyi/#|qjs), [crypto](https://developer.mozilla.org/en-US/docs/Web/API/Window/crypto) object and following Web APIs:
  - [URL](https://developer.mozilla.org/docs/Web/API/URL)
  - [URLSearchParams](https://developer.mozilla.org/docs/Web/API/URLSearchParams)
  - [FormData](https://developer.mozilla.org/docs/Web/API/FormData)
  - [Headers](https://developer.mozilla.org/docs/Web/API/Headers)
  - [Request](https://developer.mozilla.org/docs/Web/API/Request)
  - [Response](https://developer.mozilla.org/docs/Web/API/Response)
  - [Blob](https://developer.mozilla.org/docs/Web/API/Blob)
  - [TextEncoder](https://developer.mozilla.org/docs/Web/API/TextEncoder)
  - [TextDecoder](https://developer.mozilla.org/docs/Web/API/TextDecoder)
  - [ReadableStream](https://developer.mozilla.org/docs/Web/API/ReadableStream)
  - [WritableStream](https://developer.mozilla.org/docs/Web/API/WritableStream)
  - [TransformStream](https://developer.mozilla.org/docs/Web/API/TransformStream)
  - [DecompressionStream](https://developer.mozilla.org/docs/Web/API/DecompressionStream)
  - [CompressionStream](https://developer.mozilla.org/docs/Web/API/CompressionStream)

## License [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FNE0N0US%2Fqurl-proxy.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FNE0N0US%2Fqurl-proxy?ref=badge_shield&issueType=license)
Licensed under the Apache License, Version 2.0. See:
- [LICENSE](./LICENSE)
- [NOTICE](./NOTICE)

[(Top)](#qurl-proxy-)
