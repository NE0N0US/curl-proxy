export type StringRecord = Record<string, string>

export type Constructable<T = any> = new (...args: any[]) => T

export type Bytes = Uint8Array<ArrayBuffer>

/** `Request` | `Response` */
export type Body = ReadableStream<Bytes> | null | undefined

export interface ProxyConfig {
	/** default - 300 000: https://vercel.com/docs/functions/configuring-functions/duration#duration-limits */
	GLOBAL_TIMEOUT: number
	/** default - 16 */
	URL_COUNT_MAX: number
	/** default - 16 */
	PROXY_RECURSION_MAX: number
	/** default - 10 000 */
	RUN_CUSTOM_MS: number
	/** default - 256 MiB */
	RUN_CUSTOM_BYTES: number
	/** default - false */
	RUN_CUSTOM_UNSAFE: boolean
}

export interface ProxyConfigVercel extends ProxyConfig {
	ALLOW_HELP_HTML: boolean
	GITHUB_API_MD: string
	GITHUB_API_VER: string
	/** [create](https://github.com/settings/personal-access-tokens/new) and add to [.env](https://vercel.com/docs/environment-variables#development-environment-variables): `key=value` */
	GITHUB_API_TOKEN?: string
}
