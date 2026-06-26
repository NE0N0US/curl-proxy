# Usage
```url
http://localhost:3000/api/proxy?url=<url>[&headers=<json_object>][&delheaders=<json_array>][&resheaders=<json_object>][&delresheaders=<json_array>][&skipdefaults][&status=<status_code>][&statustext=<status_message>][&retry=<limit=0>][&retryin=<milliseconds=0>][&timeout=<milliseconds=300000>][&throttle=<kbps=Infinity>]
```

## URL Parameters
- `url` - original resource URL, default protocol is https
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
- `status` - response status code to overwrite
- `statustext` - response status message to overwrite
- `retry` - retries after first request
- `retryin` - milliseconds between retries
- `timeout` - milliseconds to abort request after
- `throttle` - bandwidth limit in kbit/s
