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
  [&timeout=<milliseconds=300000>]
  [&throttle=<kbps=Infinity>]
```

## URL Parameters
- `url` - resource URL, default `http`, *repeatable*, first response used, others in `X-Responses`
- `fastest` - return first completed response, abort others
- `headers` - request headers to overwrite, in addition to:
  ```json
  {"Sec-Fetch-Site": "same-site"}
  ```
- `delheaders` - names of request headers to delete, in addition to:
  ```json
  ["Cache-Control", "Pragma", "If-Modified-Since", "If-None-Match", "Origin", "Referer", "Forwarded", "X-Forwarded-For", "X-Forwarded-Host"]
  ```
- `resheaders` - response headers to overwrite, in addition to:
  ```json
  {"Access-Control-Allow-Origin": "*"}
  ```
- `delresheaders` - names of response headers to delete
- `skipdefaults` - do not apply default header changes
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
- `retryin` - milliseconds between retries
- `timeout` - milliseconds to abort request after
- `throttle` - bandwidth limit in kbit/s

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
