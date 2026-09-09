import zlib from 'node:zlib'
import stream from 'node:stream'

import {Body, Bytes} from '../types.ts'
import {atobStream, btoaStream, getAbortError} from '../utils.ts'
import {AcceptEncodingHeader} from '../http.ts'

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
export function trackBody(body: Body, callback: (last: boolean) => any): Body {
	let isFirst = true
	return body?.pipeThrough(new TransformStream({
		transform(chunk, controller) {
			if(isFirst)
				callback?.(false)
			isFirst = false
			controller.enqueue(chunk)
		},
		flush() {
			callback?.(true)

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
		bytesPerTick = Math.max(
			1,
			Math.round((kbps * 1024) / 8 * tick / 1000)
		)
	let
		chunk: Bytes | undefined,
		offset = 0
	function sleep() {
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				cleanup()
				resolve()
			}, tick)
			function cleanup() {
				clearTimeout(timer)
				options.signal?.removeEventListener('abort', abort)
			}
			function abort() {
				cleanup()
				reject(options.signal?.reason ?? getAbortError())
			}
			if (options.signal) {
				if (options.signal.aborted)
					abort()
				else
					options.signal.addEventListener('abort', abort, {once: true})
			}
		})
	}
	return new ReadableStream<Bytes>({
		async pull(controller) {
			try {
				if (options.signal?.aborted)
					throw options.signal.reason ?? getAbortError()
				let remaining = bytesPerTick
				while (remaining > 0) {
					if (!chunk || offset >= chunk.length) {
						const result = await reader.read()
						if (result.done) {
							controller.close()
							return
						}
						chunk = result.value
						offset = 0
					}
					const size = Math.min(remaining, chunk.length - offset)
					controller.enqueue(chunk.subarray(offset, offset + size))
					offset += size
					remaining -= size
				}
				await sleep()
			}
			catch (reason) {
				await reader.cancel(reason).catch(() => {})
				controller.error(reason)
			}
		},
		async cancel(reason) {
			await reader.cancel(reason)
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
