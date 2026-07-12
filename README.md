# cURL Proxy
**cURL Proxy** is an unauthenticated, non-caching, Node.js **HTTP(S) proxy** that supports batch requests and is [driven by URL query](#url-parameters). Headers, methods, bodies, and status codes can be overridden, and headers can also be deleted using wildcards. Responses can be transformed through *[custom JavaScript logic](#typescript-declaration-of-resbodyjavascript)*, which can chain requests and merge responses. *It also supports* retries with exponential backoff, timeouts, throttling and optional limits on request batching and recursion. By default it strips sensitive request headers and *bypasses CORS* response restrictions, useful for debugging and development. <sub>[Notes](#notes) · [Examples](#examples)</sub>

# Usage
```url
http://localhost:2077/?url=<url,multi>
  [&fastest]
  [&headers=<json_object>]
  [&delheaders=<json_array>]
  [&resheaders=<json_object>]
  [&delresheaders=<json_array>]
  [&skipdefaults]
  [&method=<http_method>]
  [&body=<body_text>]
  [&resbody=<action>]
  [&status=<status_code>]
  [&statustext=<status_message>]
  [&retry=<limit=0>]
  [&retryin=<milliseconds=0>]
  [&retryfactor=<number=1>]
  [&retrylimit=<milliseconds=Infinity>]
  [&timeout=<milliseconds=300000>]
  [&throttle=<kbps=Infinity>]
  [&throttleup=<kbps=Infinity>]
```

## URL Parameters
- `url` - resource URL, `http` assumed, *required*, *repeatable* (max. `16`), first response used, other statuses in JSON `X-Proxy-Responses`
- `fastest` - return first available response, abort others
- `headers` - request headers to overwrite (`Host` is determined dynamically)
- `delheaders` - names of request headers to delete (`Connection` is deleted along with headers listed in it, `*` is a wildcard), in addition to:
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
- `resheaders` - response headers to overwrite (`Access-Control-Expose-Headers` is set automatically), in addition to:
  ```json
  {"Access-Control-Allow-Origin": "*"}
  ```
- `delresheaders` - names of response headers to delete (`Connection` is deleted along with headers listed in it, `*` is a wildcard), in addition to:
  ```jsonc
  [
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
    "Connection", "Keep-Alive", "Proxy-Authenticate", "Trailer", "Transfer-Encoding", "Upgrade",
    // for Access-Control-Allow-Origin
    "Access-Control-Allow-Credentials",
  ]
   ```
- `skipdefaults` - do not apply default header changes, except [response safety behavior](#response-headers-safety) and setting response `X-Proxy-Recursion` (max. `16`)
- `method` - request method override
- `body` - request body text
- `resbody` - response transformation:
  - `null` - remove response body
  - `atob` - decode body from base64
  - `btoa` - encode body to base64
  - `javascript:…` - [custom handler](#typescript-declaration-of-resbodyjavascript), returns body, response or request
- `status` - response status code to overwrite
- `statustext` - response status message to overwrite
- `retry` - retries after first request
- `retryin` - milliseconds between retries, supports exponential backoff:\
  *min*(*in* * *factor*<sup>*attempt*</sup>, *limit*)
- `retryfactor` - backoff multiplier per retry (industry standard is `2`)
- `retrylimit` - backoff maximum milliseconds
- `timeout` - milliseconds to abort request after
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

## Extra
### Notes
- [Escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) complex parameters (`url`, `body`, `resbody=javascript:…`) using tools like [Postman](https://www.postman.com/)
- Keep entire URL under deployment platform limit, [14 KB for Vercel](https://vercel.com/docs/errors/url_too_long)
- Additional `url` along with `skipdefaults` can be used to debug requests using services like [Webhook.site](https://webhook.site/)
- You can debug requests and get fake responses in [httpbin](https://httpbin.org/) and [JSONPlaceholder](https://jsonplaceholder.typicode.com/)
- You can edit JSON objects and arrays in [visual editors](https://dataformatterpro.com/json-editor/) and should [minify](https://jsonlint.com/json-minify) it
- Both `url` count and *recursion* level are limited for performance and security reasons
- HTTP reference: [headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers), [request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods), [response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
- Default response header changes allow *bypassing CORS* restrictions on [request origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin) and [response headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers)
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
- Common mobile network speed, kbit/s:
  | Type | Download | Upload |
  |:----:|---------:|-------:|
  | 3G   |      384 |    256 |
  | H    |    7 000 |  2 000 |
  | H+   |   12 000 |  5 000 |
  | 4G   |   50 000 | 15 000 |
  | 4G+  |  100 000 | 40 000 |
- You can [ask DeepWiki](https://deepwiki.com/NE0N0US/curl-proxy) about this project

### Examples
Under construction

[(Top)](#curl-proxy)
