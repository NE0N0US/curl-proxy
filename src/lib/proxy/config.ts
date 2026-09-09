import os from 'node:os'

import {VERSION} from '../../version.ts'
import {AcceptHeader, Header, AC_ALLOW_ORIGIN_DEFAULT} from '../http.ts'
import {ProxyConfig} from '../types.ts'
import {SearchDefaults} from './headers.ts'

// #region - data

export const vercelConfig = {
	// https://vercel.com/docs/functions/configuring-functions/duration#duration-limits
	globalTimeout: +(process.env.GLOBAL_TIMEOUT || 300_000),
	urlCountMax: +(process.env.URL_COUNT_MAX || 16),
	proxyRecursionMax: +(process.env.PROXY_RECURSION_MAX || 16),
	runCustomMs: +(process.env.RUN_CUSTOM_MS || 10_000),
	runCustomBytes: +(process.env.RUN_CUSTOM_BYTES || 2 ** 20 * 2 ** 8),
	runCustomUnsafe: [true, 'true'].includes(process.env.RUN_CUSTOM_UNSAFE || false as any),
} as ProxyConfig

// #endregion

// #region - functions

export function configWithFallbacks(configInit?: Partial<ProxyConfig>): ProxyConfig {
	return {
		globalTimeout: configInit?.globalTimeout || 300_000,
		urlCountMax: configInit?.urlCountMax || Number.MAX_SAFE_INTEGER,
		proxyRecursionMax: configInit?.proxyRecursionMax || Number.MAX_SAFE_INTEGER,
		runCustomMs: configInit?.runCustomMs || Number.MAX_SAFE_INTEGER,
		runCustomBytes: configInit?.runCustomBytes || Number.MAX_SAFE_INTEGER,
		runCustomUnsafe: configInit?.runCustomUnsafe || false,
	}
}

export function proxyDebugResponse(req: Request, configInit: Partial<ProxyConfig>) {
	return new Response(JSON.stringify({
		...configWithFallbacks(configInit),
		allowHelpHtml: undefined,
		githubApiMd: undefined,
		githubApiVer: undefined,
		githubApiToken: undefined,
		cpuArch: os.arch(),
		cpuEndianness: os.endianness(),
		cpuParallelism: os.availableParallelism(),
		ramTotal: os.totalmem(),
		osPlatform: os.platform(),
		osName: os.type(),
		osRelease: os.release(),
		osKernel: os.version(),
		nodeVersions: process.versions,
		version: VERSION,
	}), {
		headers: {
			[Header.CONTENT_TYPE]: AcceptHeader.JSON,
			[Header.AC_ALLOW_ORIGIN]: req.headers.get(Header.ORIGIN) || AC_ALLOW_ORIGIN_DEFAULT,
			...SearchDefaults.RES_HEADERS,
		},
	})
}

// #endregion
