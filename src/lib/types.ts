export type StringRecord = Record<string, string>

export type Constructable<T = any> = new (...args: any[]) => T

export type Bytes = Uint8Array<ArrayBuffer>

/** `Request` | `Response` */
export type Body = ReadableStream<Bytes> | null | undefined

export interface ProxyConfig {
	/** default - `300_000` */
	globalTimeout: number
	/** default - `Number.MAX_SAFE_INTEGER` */
	urlCountMax: number
	/** default - `Number.MAX_SAFE_INTEGER` */
	proxyRecursionMax: number
	/** default - `Number.MAX_SAFE_INTEGER` */
	runCustomMs: number
	/** default - `Number.MAX_SAFE_INTEGER` */
	runCustomBytes: number
	/** default - `false` */
	runCustomUnsafe: boolean
}

export interface ProxyConfigVercel extends ProxyConfig {
	allowHelpHtml: boolean
	githubApiMd: string
	githubApiVer: string
	/** [create](https://github.com/settings/personal-access-tokens/new) and add to [.env](https://vercel.com/docs/environment-variables#development-environment-variables): `key=value` */
	githubApiToken?: string
}
