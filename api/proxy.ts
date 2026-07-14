import {ProxyConfigVercel} from '../src/lib/types.ts'
import {createProxy} from '../src/lib/proxy/index.ts'

const proxy: any = createProxy({
	// https://vercel.com/docs/functions/configuring-functions/duration#duration-limits
	globalTimeout: +(process.env.GLOBAL_TIMEOUT || 300_000),
	urlCountMax: +(process.env.URL_COUNT_MAX || 16),
	proxyRecursionMax: +(process.env.PROXY_RECURSION_MAX || 16),
	runCustomMs: +(process.env.RUN_CUSTOM_MS || 10_000),
	runCustomBytes: +(process.env.RUN_CUSTOM_BYTES || 2 ** 20 * 2 ** 8),
	runCustomUnsafe: [true, 'true'].includes(process.env.RUN_CUSTOM_UNSAFE || false as any),
	allowHelpHtml: [true, 'true'].includes(process.env.ALLOW_HELP_HTML || true as any),
	githubApiMd: process.env.GITHUB_API_MD || 'https://api.github.com/markdown',
	githubApiVer: process.env.GITHUB_API_VER || '2026-03-10',
	githubApiToken: process.env.GITHUB_API_TOKEN,
} as ProxyConfigVercel)

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
