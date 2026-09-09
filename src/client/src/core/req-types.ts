import JSONCrush from 'jsoncrush'
import {AppService, SearchParam} from '@'

/** params, headers*, application/x-www-form-urlencoded, multipart/form-data */
export interface ReqKV<V = string, K = string> {
	disable: boolean
	key: K
	value: V
}

type ReqV<T> = Omit<ReqKV<T>, 'key'>

export enum ReqBodyType {
	NONE = 'none',
	TEXT = 'text',
	FILE = 'file',
	FORM_URLENCODED = 'form-urlencoded',
	FORM_MULTIPART = 'form-multipart',
}

export type ReqBody = null | string | File | ReqKV[] | ReqKV<string | File[]>[]

export enum ResBodyType {
	NONE = '',
	NULL = 'null',
	ATOB = 'atob',
	BTOA = 'btoa',
	JAVASCRIPT = 'javascript',
}

// #region - req options

function getReqKv() {
	return {
		textMode: false,
		textValue: '',
		rows: [] as ReqKV[],
		pagination: {page: 1, rowsPerPage: 1},
	}
}

function getReqBody() {
	return {
		type: ReqBodyType.NONE,
		formTextMode: false,
		formTextValue: '',
		formPagination: {page: 1, rowsPerPage: 1},
		fileAccept: '*/*',
		textLang: null as null | string,
		value: null as ReqBody,
	}
}

function getReqOptionsHeadersAll() {
	return Object.fromEntries(
		['headers', 'delHeaders', 'resHeaders', 'delResHeaders'].map(name => [name, {
			name,
			deleteMode: name.startsWith('del'),
			...getReqKv(),
		}])
	)
}

export class ReqOptions {
	includeCredentials = false
	integrityHashes: ReqV<string> = {disable: false, value: ''}
	qurlProxy: {
		server: ReqV<string>,
		urls: ReqV<string>,
		fastest: boolean,
		retry: string,
		retryIn: string,
		retryFactor: string,
		retryLimit: string,
		timeout: string,
		ttfb: string,
		throttle: string,
		throttleUp: string,
		status: string,
		renResHeaders: boolean,
		skipDefaults: boolean,
		method: string,
		tab: string,
		headersAll: ReturnType<typeof getReqOptionsHeadersAll>,
		body: ReturnType<typeof getReqBody>,
		resBody: string,
	} = {
		server: {disable: true, value: AppService.resolveUrl('/')},
		urls: {disable: false, value: ''},
		fastest: false,
		method: '',
		status: '',
		retry: '',
		retryIn: '',
		retryFactor: '',
		retryLimit: '',
		timeout: '',
		ttfb: '',
		throttle: '',
		throttleUp: '',
		renResHeaders: false,
		skipDefaults: false,
		tab: 'headers',
		headersAll: getReqOptionsHeadersAll(),
		body: getReqBody(),
		resBody: '',
	}
}

// #endregion

// #region - req

function tryCrush(json: string) {
	try {
		const crushed = JSONCrush.crush(json)
		return encodeURIComponent(crushed).length < encodeURIComponent(json).length ? crushed : json
	}
	catch {
		return json
	}
}

async function stringifyReqBody(type: ReqBodyType, body: ReqBody) {
	switch (type) {
		case ReqBodyType.TEXT:
			return body as string
		case ReqBodyType.FILE:
			if (body)
				return await (body as File).text()
			else
				break
		case ReqBodyType.FORM_URLENCODED:
		case ReqBodyType.FORM_MULTIPART:
			const fields = (body as ReqKV[] | ReqKV<string | File[]>[])
				.filter(({disable, key}) => !disable && key)
				.flatMap(({key, value}) => Array.isArray(value)
					? value.map(value => [key, value])
					: [[key, value]]
				)
			if (type === ReqBodyType.FORM_URLENCODED && fields.length)
				return new URLSearchParams(fields as string[][]).toString()
			else if (type === ReqBodyType.FORM_MULTIPART && fields.length) {
				const form = new FormData()
				fields.forEach(([key, value]) => form.append(key as string, value!))
				const
					req = new Request('', {method: 'POST', body: form}),
					buffer = await req.arrayBuffer(),
					text = new TextDecoder().decode(buffer)
				return text
			}
	}
}

async function getFullReqUrl(req: Req) {
	if (req.urlValid) {
		const
			url = AppService.resolveUrl(req.url),
			{
				server, urls,
				fastest, renResHeaders, skipDefaults,
				retry, retryIn, retryFactor, retryLimit,
				timeout, ttfb, throttle, throttleUp,
				status, method, resBody,
				headersAll: {headers, delHeaders, resHeaders, delResHeaders},
				body: {type: bodyType, value: body},
			} = req.options.qurlProxy,
			params: [string, string][] = [[SearchParam.URL, url]]
		if (server.disable || !server.value)
			return url
		// urls
		if (!urls.disable)
			params.push(...urls.value
				.split('\n')
				.filter(line => line)
				.map(url => [SearchParam.URL, url] as [string, string])
			)
		// flags
		;[
			[SearchParam.FASTEST, fastest],
			[SearchParam.REN_RES_HEADERS, renResHeaders],
			[SearchParam.SKIP_DEFAULTS, skipDefaults],
		].forEach(([key, value]) => {
			if (value)
				params.push([key as string, ''])
		})
		// primitives
		;[
			[SearchParam.RETRY, retry],
			[SearchParam.RETRY_IN, retryIn],
			[SearchParam.RETRY_FACTOR, retryFactor],
			[SearchParam.RETRY_LIMIT, retryLimit],
			[SearchParam.TIMEOUT, timeout],
			[SearchParam.TTFB, ttfb],
			[SearchParam.THROTTLE, throttle],
			[SearchParam.THROTTLE_UP, throttleUp],
			[SearchParam.STATUS, status],
			[SearchParam.METHOD, method],
			[SearchParam.RES_BODY, resBody],
		].forEach(([key, value]) => {
			if (value)
				params.push([key as string, value])
		})
		// objects
		;[
			[SearchParam.HEADERS, headers],
			[SearchParam.RES_HEADERS, resHeaders],
		].forEach(([key, value]) => {
			const entries = ((value as any).rows as ReqKV[])
				.filter(({disable, key}) => !disable && key)
				.map(({key, value}) => [key, value])
			if (entries.length)
				params.push([
					key as string,
					tryCrush(JSON.stringify(Object.fromEntries(entries))),
				])
		})
		// arrays
		;[
			[SearchParam.DEL_HEADERS, delHeaders],
			[SearchParam.DEL_RES_HEADERS, delResHeaders],
		].forEach(([key, value]) => {
			const keys = ((value as any).rows as ReqKV[])
				.filter(({disable, key}) => !disable && key)
				.map(({key}) => key)
			if (keys.length)
				params.push([
					key as string,
					tryCrush(JSON.stringify(keys)),
				])
		})
		// body
		const bodyString = await stringifyReqBody(bodyType, body)
		if (bodyString !== undefined)
			params.push([SearchParam.BODY, bodyString])
		return AppService.resolveUrl(server.value) + '?' + params
			.map(([key, value]) => `${encodeURIComponent(key)}${value ? '=' : ''}${encodeURIComponent(value)}`)
			.join('&')
	}
	else
		return null
}

function toRequestBody(type: ReqBodyType, body: ReqBody) {
	switch (type) {
		case ReqBodyType.TEXT:
		case ReqBodyType.FILE:
			return <string | null | File>body
		case ReqBodyType.FORM_URLENCODED:
		case ReqBodyType.FORM_MULTIPART:
			const fields = (body as ReqKV[] | ReqKV<string | File[]>[])
				.filter(({disable, key}) => !disable && key)
				.flatMap(({key, value}) => Array.isArray(value)
					? value.map(value => [key, value])
					: [[key, value]]
				)
			if (type === ReqBodyType.FORM_URLENCODED && fields.length)
				return new URLSearchParams(fields as string[][])
			else if (type === ReqBodyType.FORM_MULTIPART && fields.length) {
				const formData = new FormData()
				fields.forEach(([key, value]) => formData.append(key as string, value!))
				return formData
			}
		default:
			return null
	}
}

async function toRequest(req: Req) {
	if (!req.urlValid)
		return null
	const aborter = new AbortController()
	return {
		request: new Request((await req.urlFull)!, {
			body: toRequestBody(req.body.type, req.body.value),
			cache: 'no-store',
			credentials: req.options.includeCredentials ? 'include' : 'omit',
			headers: new Headers(req.headers.rows
				.filter(({disable, key}) => !disable && key)
				.map(({key, value}) => [key, value] as [string, string])
			),
			...(req.options.integrityHashes.disable || !req.options.integrityHashes.value)
				? {} : {integrity: req.options.integrityHashes.value},
			method: req.method,
			priority: 'high',
			signal: aborter.signal,
		}),
		abort: aborter.abort.bind(aborter),
	}
}

function setFetching(req: Req, fetching: boolean, recursive = false) {
	if (req.fetching !== fetching) {
		if (recursive) {
			req.fetchStats ??= []
			req.fetchStats.push(req.result!.error ? false : {
				ok: req.result!.res!.ok,
				resMs: req.result!.resMs!,
				blobMs: req.result!.blobMs!,
			})
		}
		else if (fetching)
			req.fetchStats = null
		switch (req._state) {
			case 'idle':
				req._state = 'prepare'
				const aborter = new AbortController()
				req._abort = aborter.abort.bind(aborter)
				toRequest(req)
					.then(request => {
						if (!aborter.signal.aborted) {
							if (!request)
								req._state = 'idle'
							else {
								req._state = 'fetch'
								req._abort = request.abort
								const fetchTime = performance.now()
								fetch(request.request)
									.then(res => {
										const
											resTime = performance.now(),
											resMs = resTime - fetchTime
										req.result ??= {}
										delete req.result.error
										Object.assign(req.result, {
											res,
											resMs,
											resTime: performance.timeOrigin + resTime,
											blobSize: 0,
											blob: req.result.blob,
											blobMs: req.result?.blobMs === undefined ? undefined
												: req.result.blobMs - (resMs - req.result.resMs!),
										})
										new Response(res.body?.pipeThrough(
											new TransformStream({
												transform(chunk, controller) {
													if (!request.request.signal.aborted)
														req.result!.blobSize! += chunk.byteLength
													controller.enqueue(chunk)
												},
											})
										), res).blob()
											.then(blob => {
												if (!request.request.signal.aborted) {
													req._state = 'idle'
													Object.assign(req.result!, {
														blob,
														blobMs: performance.now() - resTime,
													})
													if (req.fetchRepeat)
														setFetching(req, fetching, true)
												}
											})
											.catch(error => {
												if (req._state === 'fetch') {
													req._state = 'idle'
													Object.assign(req.result!, {error})
													if (req.fetchRepeat)
														setFetching(req, fetching, true)
												}
											})
									})
									.catch(error => {
										if (req._state === 'fetch') {
											req._state = 'idle'
											req.result = {error}
											if (req.fetchRepeat)
												setFetching(req, fetching, true)
										}
									})
							}
						}
					})
					.catch(error => {
						if (!aborter.signal.aborted) {
							req._state = 'idle'
							req.result = {error}
							if (req.fetchRepeat)
								setFetching(req, fetching, true)
						}
					})
				break
			case 'prepare':
			case 'fetch':
				req._state = 'idle'
				req._abort?.()
				req.fetchRepeat = false
				if (req.result) {
					delete req.result.resMs
					delete req.result.resTime
				}
				break
		}
	}
}

export class Req {
	id = 0
	method = 'GET'
	url = ''
	get urlValid() {
		const {server} = this.options.qurlProxy
		return !!this.url && AppService.isValidUrl(AppService.resolveUrl(this.url))
			&& (server.disable || !server.value || AppService.isValidUrl(AppService.resolveUrl(server.value)))
	}
	get urlFull() {
		return getFullReqUrl(this)
	}
	tab = 'params'
	params = getReqKv()
	headers = getReqKv()
	body = getReqBody()
	options = new ReqOptions()

	/** @private */
	_state: 'idle' | 'prepare' | 'fetch' = 'idle'
	/** @private */
	_abort: null | Function = null
	get fetching() {
		return this._state !== 'idle'
	}
	set fetching(fetching) {
		setFetching(this, fetching)
	}
	fetchRepeat = false
	fetchStats: null | Array<{
		ok: boolean,
		resMs: number,
		blobMs: number,
	} | false> = null
	result: null | Partial<{
		res: Response,
		resMs: number,
		resTime: number,
		blobSize: number,
		blob: Blob,
		blobMs: number,
		error: Error,
	}> = null
	resultTab = 'body'
	resultBodyTab = 'preview'
	resultHeadersTextMode = false
	resultHeadersPagination = {page: 1, rowsPerPage: 1}

	/** preserve tabs and paginations */
	patchView(req: Req) {
		this.tab = req.tab
		this.params.pagination = req.params.pagination
		this.headers.pagination = req.headers.pagination
		this.body.formPagination = req.body.formPagination
		this.options.qurlProxy.tab = req.options.qurlProxy.tab
		this.options.qurlProxy.headersAll.headers!.pagination =
			req.options.qurlProxy.headersAll.headers!.pagination
		this.options.qurlProxy.headersAll.delHeaders!.pagination =
			req.options.qurlProxy.headersAll.delHeaders!.pagination
		this.options.qurlProxy.headersAll.resHeaders!.pagination =
			req.options.qurlProxy.headersAll.resHeaders!.pagination
		this.options.qurlProxy.headersAll.delResHeaders!.pagination =
			req.options.qurlProxy.headersAll.delResHeaders!.pagination
		this.options.qurlProxy.body.formPagination =
			req.options.qurlProxy.body.formPagination
		this.resultTab = req.resultTab
		this.resultBodyTab = req.resultBodyTab
		this.resultHeadersTextMode = req.resultHeadersTextMode
		this.resultHeadersPagination = req.resultHeadersPagination
		return this
	}

	strip(...keys: (keyof Req)[]) {
		keys.forEach(key => delete this[key])
		return this
	}
}

// #endregion
