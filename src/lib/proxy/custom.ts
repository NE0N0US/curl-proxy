import crypto from 'node:crypto'

import {Body, Bytes} from '../types.ts'
import {checkAbortSignal} from '../utils.ts'
import {Header, streamify} from '../http.ts'
import {runSandboxed} from '../sandbox.ts'

import {SearchParam} from './params.ts'

// #region - functions

/** `bytes`, `text` and `json` are smart accessors */
async function reqResView(source: Request | Response, rejectGet?: Function) {
	let bytes: Bytes, text: string, json
	if (rejectGet)
		source = source.clone()
	else
		bytes = !source.body ? new Uint8Array() : await new Response(source.body).bytes()
	const view = {
		url: source.url,
		headers: Object.fromEntries(source.headers),
		// body
		body: source.body,
		get bytes() {
			rejectGet?.()
			return bytes
		},
		set bytes(value) {
			bytes = value
		},
		get text() {
			rejectGet?.()
			return text ??= new TextDecoder().decode(view.bytes)
		},
		set text(value) {
			text = value
		},
		get json() {
			rejectGet?.()
			return json ??= JSON.parse(view.text)
		},
		set json(value) {
			json = value
		},
	}
	return view
}

/** @throws {any} */
async function runCustom(
	req: Request, res: Response, responses: Array<Response | null>, code: string,
	timeout: number, memoryLimitBytes: number, useNodeVm: boolean,
	onDisposeError: (error: any) => any, readBodies = false
): Promise<Request | Response | Body | Bytes | unknown> {
	let bodyRead = false
	const
		onBodyRead = readBodies ? undefined : () => bodyRead = true,
		reqView = Object.assign(await reqResView(req, onBodyRead), {method: req.method}),
		[resView, ...responsesViews] = await Promise.all([res, ...responses].map(async res =>
			res ? Object.assign(await reqResView(res, onBodyRead), {
				cookies: res.headers.getSetCookie(),
				ok: res.ok,
				redirected: res.redirected,
				status: res.status,
				statusText: res.statusText,
			}) : res
		)),
		expose = {
			req: reqView,
			res: resView!,
			responses: responsesViews,
			crypto,
		},
		exposeClasses = {
			URL,
			URLSearchParams,
			FormData,
			Headers,
			Request,
			Response,
			Blob,
			TextEncoder,
			TextDecoder,
			ReadableStream,
			WritableStream,
			TransformStream,
			DecompressionStream,
			CompressionStream,
		}
	const result = await runSandboxed(code, expose, exposeClasses, timeout, memoryLimitBytes, useNodeVm, onDisposeError)
	return (!readBodies && bodyRead)
		? await runCustom(req, res, responses, code, timeout, memoryLimitBytes, useNodeVm, onDisposeError, true) : result
}

/** @throws {any} */
export async function processCustom(
	req: Request, res: Response, responses: Array<Response | null>,
	state: {request?: Request, body?: Body, headers: Headers, status: number, statusText: string},
	code: string | undefined, timeout: number, memoryLimitBytes: number, useNodeVm: boolean,
	onDisposeError: (error: any) => any,
) {
	if (code === undefined)
		return state
	const result = await runCustom(
		req,
		new Response(res.body, state),
		responses,
		code,
		timeout,
		memoryLimitBytes,
		useNodeVm,
		onDisposeError
	)
	checkAbortSignal(req.signal)
	let deleteContentLength
	if (result instanceof Request) {
		const
			{origin, pathname} = new URL(req.url),
			url = new URL(result.url)
		state.request = origin + pathname === url.origin + url.pathname
			? result : new Request(new URL(
				`?${SearchParam.URL}=${encodeURIComponent(result.url)}`,
				req.url
			), result)
	}
	if (result instanceof Response)
		Object.assign(state, {
			body: result.body,
			headers: new Headers(result.headers),
			status: result.status,
			statusText: result.statusText,
		})
	else if (result instanceof ReadableStream || result === null) {
		state.body = result
		deleteContentLength = true
	}
	else if (result instanceof Uint8Array) {
		state.body = streamify(result as Uint8Array<ArrayBuffer>)
		deleteContentLength = true
	}
	else if(result !== undefined) {
		state.body = streamify(result?.toString())
		deleteContentLength = true
	}
	if (deleteContentLength)
		(state.headers as Headers).delete(Header.CONTENT_LENGTH)
	return state
}

// #endregion
