/** https://vercel.com/docs/functions/configuring-functions/duration#duration-limits */
export const GLOBAL_TIMEOUT = +(process.env.GLOBAL_TIMEOUT || 300_000)

export const URL_COUNT_MAX = +(process.env.URL_COUNT_MAX || 16)

export const PROXY_RECURSION_MAX = +(process.env.PROXY_RECURSION_MAX || 16)

export const RUN_CUSTOM_MS = +(process.env.RUN_CUSTOM_MS || 10_000)

export const RUN_CUSTOM_BYTES = +(process.env.RUN_CUSTOM_BYTES || 2 ** 20 * 2 ** 8)

export const RUN_CUSTOM_UNSAFE = process.env.RUN_CUSTOM_UNSAFE === true?.toString()

export const GITHUB_API_MD = process.env.GITHUB_API_MD || 'https://api.github.com/markdown'

export const GITHUB_API_VER = process.env.GITHUB_API_VER || '2026-03-10'

/** [create](https://github.com/settings/personal-access-tokens/new) and add to [.env](https://vercel.com/docs/environment-variables#development-environment-variables): `key=value` */
export const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN
