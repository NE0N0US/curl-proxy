import zlib from 'node:zlib'
import stream from 'node:stream'

import {Body, Bytes} from '../types'
import {atobStream, btoaStream, getAbortError} from '../utils'
import {AcceptEncodingHeader} from '../http'

// #region - data

const THROTTLE_TICK_DEFAULT = 50

export enum ResBodyParam {
	NULL = 'null',
	ATOB = 'atob',
	BTOA = 'btoa',
	JAVASCRIPT = 'javascript:',
}

// #endregion

// #region - functions

/** first and last chunks */
export function trackBody(body: Body, consolePrefix: string): Body {
	let isFirst = true
	return body?.pipeThrough(new TransformStream({
		transform(chunk, controller) {
			if(isFirst)
				console.time(consolePrefix + 'body')
			isFirst = false
			controller.enqueue(chunk)
		},
		flush() {
			console.timeEnd(consolePrefix + 'body')
		},
	}))
}

/** limit bandwidth @byLlm */
export function throttleBody(body: Body, kbps: number, options: Partial<{
	signal: AbortSignal,
	tick: number,
}> = {}): Body {
	if (!body || kbps <= 0)
		return body
	const
		tick = options.tick || THROTTLE_TICK_DEFAULT,
		reader = body.getReader(),
		state = {
			done: false,
			chunks: [] as Bytes[],
			offset: 0,
			aborted: false,
			reason: undefined as any,
		}
	options.signal?.addEventListener('abort', () =>
		Object.assign(state, {
			aborted: options.signal!.aborted,
			reason: options.signal!.reason,
		}),
	{once: true})
	return new ReadableStream<Bytes>({
		cancel(reason) {
			reader.cancel(reason)
		},
		start() {
			(async () => {
				while (!state.done) {
					const chunk = await reader.read()
					state.done = chunk.done
					state.chunks.push(...chunk.value ? [chunk.value] : [])
				}
			})().catch(() => state.done = true)
		},
		async pull(controller) {
			while (!state.done && !state.chunks.length)
				await new Promise(resolve => setTimeout(resolve, 1))
			if (!state.chunks.length)
				return controller.close()
			let tickBytes = Math.round((kbps * 1024) / 8 * tick / 1000)
			while (tickBytes > 0 && state.chunks.length) {
				const
					chunk = state.chunks[0],
					slice = Math.min(tickBytes, chunk.length - state.offset)
				controller.enqueue(
					chunk.subarray(state.offset, state.offset + slice)
				)
				state.offset += slice
				tickBytes -= slice
				if (state.offset === chunk.length) {
					state.chunks.shift()
					state.offset = 0
				}
			}
			await new Promise((resolve, reject) => {
				if (state.aborted)
					reject(state.reason ?? getAbortError())
				else
					setTimeout(resolve, tick)
			})
		},
	})
}

/** compress */
export function encodeBody(body: Body, encoding: string, signal?: AbortSignal): Body {
	if (!body)
		return body
	let transform: stream.Transform | undefined
	switch (encoding) {
		case AcceptEncodingHeader.GZIP:
			transform = zlib.createGzip({level: zlib.constants.Z_BEST_COMPRESSION})
			break
		case AcceptEncodingHeader.DEFLATE:
			transform = zlib.createDeflate({level: zlib.constants.Z_BEST_COMPRESSION})
			break
		case AcceptEncodingHeader.BROTLI:
			transform = zlib.createBrotliCompress()
			break
		case AcceptEncodingHeader.ZSTD:
			transform = zlib.createZstdCompress({params: {
				[zlib.constants.ZSTD_c_compressionLevel]: zlib.constants.ZSTD_btultra2,
			}})
			break
	}
	function abort() {
		transform?.destroy(signal?.reason ?? getAbortError())
	}
	if (signal?.aborted)
		abort()
	signal?.addEventListener('abort', abort, {once: true})
	return transform ? stream.Readable.toWeb(
		stream.Readable.fromWeb(body as any).pipe(transform)
	) as any : body
}

/** apply `resbody` param */
export function transformBody(body: Body, transform: string | undefined, signal?: AbortSignal): Body {
	if (!transform)
		return body
	const fn = transform.toLowerCase()
	if (fn === ResBodyParam.NULL)
		return null
	else if (([
		ResBodyParam.ATOB,
		ResBodyParam.BTOA,
	] as string[]).includes(fn)) {
		if (!body)
			return body
		const transformStream = fn === ResBodyParam.ATOB
			? atobStream() : btoaStream()
		function abort() {
			transformStream?.destroy(signal?.reason ?? getAbortError())
		}
		if (signal?.aborted)
			abort()
		signal?.addEventListener('abort', abort, {once: true})
		return stream.Readable.toWeb(
			stream.Readable.fromWeb(body as any).pipe(transformStream)
		) as any
	}
	return body
}

// #endregion
