import JSONCrush from 'jsoncrush'
import {AppService, Req, ReqBodyType, type ReqKV, SearchParam} from '@'

export class ReqService {
	static #syncReqParams(params: ReqKV[], reqParams: URLSearchParams) {
		const
			indices = new Set<number>(),
			newParams: ReqKV[] = params.map(param => ({...param}))
		reqParams.forEach((value, key) => {
			let index = newParams.findIndex((param, index) =>
				!param.disable && param.key && param.key === key && !indices.has(index)
			)
			if (index === -1)
				index = newParams.push({disable: false, key, value}) - 1
			else
				newParams[index]!.value = value
			indices.add(index)
		})
		return newParams.filter((param, index) => param.disable || !param.key || indices.has(index))
	}

	static extractUrlParams(value: string, params: ReqKV[]) {
		try {
			const url = value ? new URL(AppService.resolveUrl(value)) : null
			return ReqService.#syncReqParams(params,
				url?.searchParams ?? new URLSearchParams()
			)
		}
		catch {
			return params
		}
	}

	static #tryParse<T = any>(anyJson: string) {
		try {
			return JSON.parse(anyJson) as T
		}
		catch {
			try {
				return JSON.parse(JSONCrush.uncrush(anyJson)) as T
			}
			catch {}
		}
	}

	static extractCurlProxy(req: Req) {
		const
			url = new URL(AppService.resolveUrl(req.url)),
			serverUrl = url.origin + url.pathname,
			urls = url.searchParams.getAll(SearchParam.URL)
				.map(url => AppService.resolveUrl(url, serverUrl))
		req.url = urls[0]!
		// server
		req.options.curlProxy.server.disable = false
		req.options.curlProxy.server.value = serverUrl
		// urls
		req.options.curlProxy.urls.disable = false
		req.options.curlProxy.urls.value = urls.slice(1).join('\n')
		// flags
		req.options.curlProxy.fastest = url.searchParams.has(SearchParam.FASTEST)
		req.options.curlProxy.renResHeaders = url.searchParams.has(SearchParam.REN_RES_HEADERS)
		req.options.curlProxy.skipDefaults = url.searchParams.has(SearchParam.SKIP_DEFAULTS)
		// primitives
		req.options.curlProxy.retry = url.searchParams.get(SearchParam.RETRY) ?? ''
		req.options.curlProxy.retryIn = url.searchParams.get(SearchParam.RETRY_IN) ?? ''
		req.options.curlProxy.retryFactor = url.searchParams.get(SearchParam.RETRY_FACTOR) ?? ''
		req.options.curlProxy.retryLimit = url.searchParams.get(SearchParam.RETRY_LIMIT) ?? ''
		req.options.curlProxy.timeout = url.searchParams.get(SearchParam.TIMEOUT) ?? ''
		req.options.curlProxy.ttfb = url.searchParams.get(SearchParam.TTFB) ?? ''
		req.options.curlProxy.throttle = url.searchParams.get(SearchParam.THROTTLE) ?? ''
		req.options.curlProxy.throttleUp = url.searchParams.get(SearchParam.THROTTLE_UP) ?? ''
		req.options.curlProxy.status = url.searchParams.get(SearchParam.STATUS) ?? ''
		req.options.curlProxy.method = url.searchParams.get(SearchParam.METHOD) ?? ''
		req.options.curlProxy.resBody = url.searchParams.get(SearchParam.RES_BODY) ?? ''
		// objects
		const [headers, resHeaders] = [SearchParam.HEADERS, SearchParam.RES_HEADERS]
			.map(param => Object.entries(ReqService.#tryParse(url.searchParams.get(param) || '{}') ?? {})
				.map(([key, value]) => ({disable: false, key, value: value?.toString() ?? ''}))
			)
		req.options.curlProxy.headersAll.headers!.rows = headers!
		req.options.curlProxy.headersAll.resHeaders!.rows = resHeaders!
		// arrays
		const [delHeaders, delResHeaders] = [SearchParam.DEL_HEADERS, SearchParam.DEL_RES_HEADERS]
			.map(param => (ReqService.#tryParse<unknown[]>(url.searchParams.get(param) || '[]') ?? [])
				.map(key => ({disable: false, key: key?.toString() ?? '', value: ''}))
			)
		req.options.curlProxy.headersAll.delHeaders!.rows = delHeaders!
		req.options.curlProxy.headersAll.delResHeaders!.rows = delResHeaders!
		// body
		req.options.curlProxy.body.type =
			url.searchParams.has(SearchParam.BODY) ? ReqBodyType.TEXT : ReqBodyType.NONE
		req.options.curlProxy.body.value = url.searchParams.get(SearchParam.BODY)
	}

	static #deserializeBody(obj: any) {
		switch (obj.bodyType) {
			case ReqBodyType.FILE:
				return new File([], obj.body)
			case ReqBodyType.FORM_MULTIPART:
				return (obj.body as ReqKV<string | string[], string>[])
					.map(row => ({
						...row,
						value: Array.isArray(row.value)
							? row.value.map(name => new File([], name)) : row.value,
					}))
			default:
				return obj.body
		}
	}

	static deserialize(obj: any) {
		const req = new Req()
		req.method = obj.method ?? 'GET'
		req.url = obj.url ?? ''
		req.headers.rows = obj.headers ?? []
		req.body.type = obj.bodyType ?? ReqBodyType.NONE
		req.body.value = ReqService.#deserializeBody(obj) ?? null
		req.options.includeCredentials = obj.includeCredentials ?? false
		req.options.integrityHashes.disable = false
		req.options.integrityHashes.value = obj.integrityHashes ?? ''
		if (obj.extractCurlProxy)
			ReqService.extractCurlProxy(req)
		req.params.rows = ReqService.extractUrlParams(req.url, req.params.rows)
		return req
	}

	static #serializeBody(req: Req) {
		switch (req.body.type) {
			case ReqBodyType.FILE:
				return (req.body.value as File).name
			case ReqBodyType.FORM_MULTIPART:
				return (req.body.value as ReqKV<string | File[], string>[])
					.map(row => ({
						...row,
						value: Array.isArray(row.value)
							? row.value.map(({name}) => name) : row.value,
					}))
			default:
				return req.body.value
		}
	}

	static async serialize(req: Req) {
		const url = await req.urlFull
		return {
			method: req.method === 'GET' ? undefined : req.method,
			url: url ? url : undefined,
			headers: req.headers.rows.length ? req.headers.rows : undefined,
			bodyType: req.body.type === ReqBodyType.NONE ? undefined : req.body.type,
			body: ReqService.#serializeBody(req) ?? undefined,
			includeCredentials: req.options.includeCredentials ? true : undefined,
			integrityHashes: req.options.integrityHashes.disable
				? undefined : req.options.integrityHashes.value || undefined,
			extractCurlProxy:
				(!!req.options.curlProxy.server.value &&
				!req.options.curlProxy.server.disable) ? true : undefined,
		}
	}
}
