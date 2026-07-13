import {ResBodyParam} from './body.ts'

export enum SearchParam {
	URL = 'url',
	FASTEST = 'fastest',
	HEADERS = 'headers',
	DEL_HEADERS = 'delheaders',
	RES_HEADERS = 'resheaders',
	DEL_RES_HEADERS = 'delresheaders',
	SKIP_DEFAULTS = 'skipdefaults',
	METHOD = 'method',
	BODY = 'body',
	RES_BODY = 'resbody',
	STATUS = 'status',
	STATUS_TEXT = 'statustext',
	RETRY = 'retry',
	RETRY_IN = 'retryin',
	RETRY_FACTOR = 'retryfactor',
	RETRY_LIMIT = 'retrylimit',
	TIMEOUT = 'timeout',
	TTFB = 'ttfb',
	THROTTLE = 'throttle',
	THROTTLE_UP = 'throttleup',
}

export function parseParams(searchParams: URLSearchParams) {
	const
		{
			[SearchParam.RES_BODY]: resbody,
			[SearchParam.TIMEOUT]: timeoutParam,
			...params
		} = Object.fromEntries(searchParams),
		[status, retry, retryIn, retryFactor, retryLimit, ttfb, throttle, throttleUp] = [
			SearchParam.STATUS,
			SearchParam.RETRY,
			SearchParam.RETRY_IN,
			SearchParam.RETRY_FACTOR,
			SearchParam.RETRY_LIMIT,
			SearchParam.TTFB,
			SearchParam.THROTTLE,
			SearchParam.THROTTLE_UP,
		].map(key => {
			const param = params[key]
			return ((param?.match(/^\d+$/) && Number.isSafeInteger(+param) && +param > 0))
				? +param : 0
		}),
		doRunCustom = resbody?.startsWith(ResBodyParam.JAVASCRIPT),
		timeout = Math.max(0, Number.isSafeInteger(+timeoutParam) ? +timeoutParam : 0)
	return {params, resbody, status, retry, retryIn, retryFactor,
		retryLimit, ttfb, throttle, throttleUp, doRunCustom, timeout}
}
