import {getProxy} from '../src/lib/proxy/index.ts'

const proxy: any = getProxy(process.env as any)

let c = 0

export default {
	/** https://vercel.com/docs/fluid-compute#optimized-concurrency */
	fetch: (req: Request) => (async () => {
		const n = c++, consolePrefix = `[${n || '*'}:*:*] `
		req.signal?.addEventListener('abort', () =>
			console.debug(consolePrefix + 'abort'),
		{once: true})
		console.time(consolePrefix + 'proxy')
		return await proxy(req, n).finally(() =>
			console.timeEnd(consolePrefix + 'proxy')
		)
	})()
}
