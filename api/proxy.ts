import undici from 'undici'
import {GLOBAL_TIMEOUT} from '../src/lib/env'
import {proxy} from '../src/lib/proxy'

undici.setGlobalDispatcher(new undici.Agent({
	connect: {timeout: GLOBAL_TIMEOUT},
	headersTimeout: GLOBAL_TIMEOUT,
	bodyTimeout: GLOBAL_TIMEOUT,
	keepAliveMaxTimeout: GLOBAL_TIMEOUT,
	strictContentLength: false,
	allowH2: true,
	autoSelectFamily: true,
	maxHeaderSize: 2 ** 16,
}))

let c = 0

export default {
	/** https://vercel.com/docs/fluid-compute#optimized-concurrency */
	fetch: (req: Request) => (async () => {
		const n = c++, consolePrefix = `[${n || '*'}:*:*] `
		req.signal?.addEventListener('abort', () =>
			console.debug(consolePrefix + 'abort'),
		{once: true})
		// console.log(`${consolePrefix}headers:\n${
		// 	JSON.stringify(Object.fromEntries(req.headers), undefined, '\t')
		// 		.replaceAll(',\n\t', '\n')
		// 		.slice(3, -2)
		// }`)
		console.time(consolePrefix + 'proxy')
		return await proxy(req, n).finally(() =>
			console.timeEnd(consolePrefix + 'proxy')
		)
	})()
}
