import {parse} from '@scrape-do/curl-parser'
import {Req, ReqBodyType, ReqService, type ReqKV} from '@'

/** POSIX shell quoting */
function shellQuote(value: string) {
	return '\'' + value.replace(/'/g, '\'\\\'\'') + '\''
}

enum CurlParam {
	REDIRECT = '-L',
	URL = '--url',
	METHOD = '-X',
	HEADER = '-H',
	BODY_TEXT = '--data-raw',
	BODY_FORM_URLENCODE = '--data-urlencode',
	BODY_FORM_MULTIPART = '-F',
}

export class CurlService {
	static async toCurl(req: Req) {
		const args: string[] = ['curl ' + CurlParam.REDIRECT]
		args.push(CurlParam.URL + ' ' + shellQuote((await req.urlFull)!))
		args.push(CurlParam.METHOD + ' ' + shellQuote(req.method))
		args.push(...req.headers.rows
			.filter(({disable, key}) => !disable && key)
			.map(({key, value}) => CurlParam.HEADER + ' ' + shellQuote(`${key}: ${value}`))
		)
		switch (req.body.type) {
			case ReqBodyType.TEXT:
			case ReqBodyType.FILE:
				const text = req.body.type === ReqBodyType.TEXT
					? req.body.value as string
					: '@' + (req.body.value as File).name
				args.push(CurlParam.BODY_TEXT + ' ' + shellQuote(text))
				if (!req.headers.rows.some(({disable, key}) =>
					!disable && key.toLowerCase() === 'content-type'
				))
					args.push(CurlParam.HEADER + ' ' + shellQuote(`Content-Type: ${
						{
							javascript: 'text/javascript',
							json: 'application/json',
							html: 'text/html',
							xml: 'application/xml',
						}[req.body.type === ReqBodyType.TEXT ? req.body.textLang ?? '' : ''] ?? 'text/plain'
					}`))
				break
			case ReqBodyType.FORM_URLENCODED:
			case ReqBodyType.FORM_MULTIPART:
				const fields = (req.body.value as ReqKV[] | ReqKV<string | File[]>[])
					.filter(({disable, key}) => !disable && key)
					.flatMap(({key, value}) => Array.isArray(value)
						? value.map(value => [key, '@' + value.name])
						: [[key, value]]
					)
				args.push(...fields.map(([key, value]) => (req.body.type === ReqBodyType.FORM_URLENCODED
					? CurlParam.BODY_FORM_URLENCODE
					: CurlParam.BODY_FORM_MULTIPART
				) + ' ' + shellQuote(`${key}=${value}`)))
				break
		}
		return args.join(' \\\n\t')
	}

	static fromCurl(curl: string) {
		const
			req = new Req(),
			{url, method, headers, formData, body, bodyArg} = parse(curl)
		req.url = url ?? ''
		req.method = method.toUpperCase()
		req.headers.rows = headers.map(row => Object.assign(row, {disable: false}))
		if (formData?.length)
			Object.assign(req.body, {
				type: ReqBodyType.FORM_MULTIPART,
				value: formData.map(row => Object.assign(row, {disable: false})),
			})
		else if (body !== null && bodyArg === 'urlencode')
			Object.assign(req.body, {
				type: ReqBodyType.FORM_URLENCODED,
				value: [...new URLSearchParams(body).entries()]
					.map(([key, value]) => ({disable: false, key, value})),
			})
		else if (body !== null)
			Object.assign(req.body, {
				type: ReqBodyType.TEXT,
				value: body,
			})
		req.params.rows = ReqService.extractUrlParams(req.url, req.params.rows)
		return req
	}
}
