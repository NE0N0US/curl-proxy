# Usage
```url
http://localhost:3000/api/proxy?url=<url,multi>
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
```

## URL Parameters
- `url` - resource URL, default `http`, *repeatable* (max. `16`), first response used, others in `X-Proxy-Responses`
- `fastest` - return first completed response, abort others
- `headers` - request headers to overwrite (`Host` is determined dynamically)
- `delheaders` - names of request headers to delete (`Connection` is deleted along with headers listed in it, `*` is a wildcard), in addition to:
  ```jsonc
  [
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers#hop-by-hop_headers
    "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "Trailer", "Transfer-Encoding", "TE", "Upgrade",
    // https://developer.mozilla.org/docs/Web/HTTP/Reference/Status/304
    "Cache-Control", "Pragma", "If-Modified-Since", "If-None-Match",
    // real addresses
    "Origin", "Referer", "Via", "Forwarded", "X-Forwarded-*", "*-IP",
    // browser data
    "Sec-CH-*", "Sec-Fetch-*",
    // for Access-Control-Allow-Origin
    "Access-Control-Allow-Credentials"
  ]
  ```
- `resheaders` - response headers to overwrite (`Access-Control-Expose-Headers` is set automatically), in addition to:
  ```json
  {"Access-Control-Allow-Origin": "*"}
  ```
- `delresheaders` - names of response headers to delete (`*` is a wildcard)
- `skipdefaults` - do not apply default header changes, except [safety behavior](#headers-safety-behavior) and setting `X-Proxy-Recursion` (max. `16`)
- `method` - HTTP method override
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
- `retryfactor` - backoff multiplier per retry
- `retrylimit` - backoff maximum milliseconds
- `timeout` - milliseconds to abort request after
- `throttle` - bandwidth limit in kbit/s

### Headers Safety Behavior
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
#### After running `resbody` [custom handler](#typescript-declaration-of-resbodyjavascript)
```typescript
if (!result instanceof Request && !result instanceof Response && result !== undefined)
  headers.delete('Content-Length')
```

### TypeScript Declaration of `resbody=javascript:…`
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
