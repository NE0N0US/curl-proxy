import crypto from 'node:crypto'

import {Body, Bytes} from '../types'
import {RUN_CUSTOM_BYTES, RUN_CUSTOM_MS, RUN_CUSTOM_UNSAFE} from '../env'
import {checkAbortSignal} from '../utils'
import {Header, streamify} from '../http'
import {runSandboxed} from '../sandbox'

// #region - functions

/** @throws {any} */
async function runCustom(
	req: Request, res: Response, responses: Array<Response | null>, code: string,
	timeout = RUN_CUSTOM_MS, memoryLimitBytes = RUN_CUSTOM_BYTES, useNodeVm = RUN_CUSTOM_UNSAFE
): Promise<Request | Response | Body | Bytes | unknown> {
	let reqText, reqJson
	const
		reqView = {
			bytes: !req.body ? new Uint8Array() : await new Response(req.body).bytes(),
			get text() {
				return reqText ??= new TextDecoder().decode(reqView.bytes)
			},
			set text(text) {
				reqText = text
			},
			get json() {
				return reqJson ??= JSON.parse(reqView.text)
			},
			set json(json) {
				reqJson = json
			},
			headers: Object.fromEntries(req.headers),
			method: req.method,
			url: req.url,
		},
		[resView, ...responsesViews] = await Promise.all([res, ...responses].map(async res => {
			if (!res)
				return res
			let resText, resJson
			const view = {
				bytes: !res.body ? new Uint8Array() : await res.bytes(),
				get text() {
					return resText ??= new TextDecoder().decode(view.bytes)
				},
				set text(text) {
					resText = text
				},
				get json() {
					return resJson ??= JSON.parse(view.text)
				},
				set json(json) {
					resJson = json
				},
				headers: Object.fromEntries(res.headers),
				cookies: res.headers.getSetCookie(),
				ok: res.ok,
				redirected: res.redirected,
				status: res.status,
				statusText: res.statusText,
				url: res.url,
			}
			return view
		})),
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
	return runSandboxed(code, expose, exposeClasses, timeout, memoryLimitBytes, useNodeVm)
}

/** @throws {any} */
export async function processCustom(
	req: Request, res: Response, responses: Array<Response | null>,
	state: {request?: Request, body?: Body, headers: Headers, status: number, statusText: string},
	code: string | undefined
) {
	if (code === undefined)
		return state
	const result = await runCustom(
		req,
		new Response(res.body, state),
		responses,
		code
	)
	checkAbortSignal(req.signal)
	let deleteContentLength
	if (result instanceof Request)
		state.request = result
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
