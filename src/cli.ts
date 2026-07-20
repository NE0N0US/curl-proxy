#!/usr/bin/env node

// #region - imports

import http from 'node:http'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {parseArgs} from 'node:util'

// @ts-expect-error
import {ENDPOINT_PROXY, ENDPOINT_PROXY_DEBUG, type ProxyConfig, createProxy, proxyDebugResponse} from './index.js'

const {console} = globalThis
// mute dependencies
globalThis.console = {log(){}, error(){}} as any

// #endregion

// #region - data

const PORT_DEFAULT = 2077

const HOSTNAME_DEFAULT = '0.0.0.0'

const GLOBAL_TIMEOUT_DEFAULT = 300_000

const cliParams: {long: string, short: string, fallback?: unknown, type?: 'boolean', description: string}[] = [
	{long: 'help', short: 'h', type: 'boolean', description: 'Show this help message'},
	{long: 'port', short: 'p', fallback: PORT_DEFAULT, description: 'Port to listen on'},
	{long: 'address', short: 'a', fallback: HOSTNAME_DEFAULT, description: 'Hostname or address to bind to'},
	{long: 'timeout', short: 't', fallback: GLOBAL_TIMEOUT_DEFAULT, description: 'Global request timeout, ms'},
	{long: 'urls', short: 'u', description: 'Max. URLs per request'},
	{long: 'recursion', short: 'r', description: 'Max. proxy recursion depth'},
	{long: 'custom-ms', short: 'm', description: 'Max. execution time for custom JavaScript handlers, ms'},
	{long: 'custom-bytes', short: 'b', description: 'Max. memory usage for custom JavaScript handlers, bytes'},
	{long: 'custom-unsafe', short: 'n', type: 'boolean', description: 'Use non-isolated Node.js VM for custom JavaScript handlers'},
]

// #endregion

// #region - functions

function toReq(msg: http.IncomingMessage, signal: AbortSignal) {
	return new Request(new URL(msg.url!, 'http://' + msg.headers.host).href, {
		method: msg.method,
		headers: new Headers(msg.headers as any),
		body: msg.method === 'GET' || msg.method === 'HEAD'
			? undefined : Readable.toWeb(msg) as any,
		signal,
		// @ts-expect-error
		duplex: 'half',
	})
}

async function sendRes(out: http.ServerResponse, res: Response, signal: AbortSignal) {
	out.setHeaders(res.headers)
	out.writeHead(res.status, res.statusText)
	if (!res.body)
		out.end()
	else
		await pipeline(Readable.fromWeb(res.body as any), out, {signal})
}

async function serveThrough(
	msg: http.IncomingMessage, out: http.ServerResponse, proxy: (req: Request) => Promise<Response>
) {
	try {
		const
			reqAbort = new AbortController(),
			req = toReq(msg, reqAbort.signal)
		msg.once('close', () => {
			if (!msg.complete)
				reqAbort.abort(new DOMException('Request Aborted', 'AbortError'))
		})
		out.once('close', () => {
			if (!out.writableFinished)
				reqAbort.abort(new DOMException('Response Aborted', 'AbortError'))
		})
		await sendRes(out, await proxy(req), reqAbort.signal)
	}
	catch (error: any) {
		console.error(error)
		if (out.headersSent)
			out.destroy(error)
		else
			out.writeHead(500)
		if (!out.destroyed && !out.writableEnded)
			out.end('Internal Server Error')
	}
}

function matchesRoute(url: string, route: string) {
	return url?.match(
		new RegExp(`^${route.replace('/', '\\/')}(?:[\\?#].*)?$`)
	)
}

function withRouting(url: string, routes: Record<string, (req: Request) => Promise<Response>>) {
	for (const [route, handler] of Object.entries(routes))
		if (matchesRoute(url, route))
			return handler
	return async (req: Request) => new Response(null, {
		status: 404,
		headers: {
			'access-control-allow-origin': req.headers.get('origin') || '*',
			'access-control-allow-headers': '*',
		},
	})
}

function serve(config: Partial<ProxyConfig> = {}, port = PORT_DEFAULT, hostname = HOSTNAME_DEFAULT) {
	const
		proxy: (req: Request) => Promise<Response> = createProxy(config, {}),
		debug = (req: Request) => proxyDebugResponse(req, config)
	return http.createServer({
		headersTimeout: config.globalTimeout || GLOBAL_TIMEOUT_DEFAULT,
		requestTimeout: config.globalTimeout || GLOBAL_TIMEOUT_DEFAULT,
		maxHeaderSize: 2 ** 16,
	}, (msg, out) => serveThrough(msg, out, withRouting(msg.url!, {
		'/': proxy,
		[ENDPOINT_PROXY]: proxy,
		[ENDPOINT_PROXY_DEBUG]: debug,
	})))
		.listen(port, hostname)
}

function tryParseNatural(value: unknown) {
	return (value && Number.isSafeInteger(+value) && +value > 0) ? +value : undefined
}

function cliConfig() {
	const {
		help, port, address, timeout, urls, recursion,
		'custom-ms': customMs,
		'custom-bytes': customBytes,
		'custom-unsafe': customUnsafe,
	} = parseArgs({options: Object.fromEntries(cliParams.map(
		({long, short, type}) => [long, {short, type: type || 'string'}]
	))}).values
	if (help)
		throw new Error('Help')
	return {
		port: tryParseNatural(port),
		hostname: address as string | undefined,
		globalTimeout: tryParseNatural(timeout),
		urlCountMax: tryParseNatural(urls),
		proxyRecursionMax: tryParseNatural(recursion),
		runCustomMs: tryParseNatural(customMs),
		runCustomBytes: tryParseNatural(customBytes),
		runCustomUnsafe: customUnsafe as boolean,
	}
}

function cliHelp() {
	const
		width = Math.max(...cliParams.map(({long, type}) => long.length + (type ? 0 : 8))),
		options = cliParams.map(({short, long, type, description, fallback}) =>
			`  -${short}, --${
				`${long}${type ? '' : ' <value>'}`.padEnd(width)
			} - ${description}${
				fallback === undefined ? '' : ` (default: ${fallback})`
			}`
		).join('\n')
	return 'Start a HTTP proxy\n\nUsage:\nnpx -y @ne0n0us/curl-proxy [options]\n\nOptions:\n' + options
}

function main() {
	try {
		const {port, hostname, ...config} = cliConfig()
		try {
			serve(config, port, hostname)
			console.log(`Listening at http://${hostname ?? HOSTNAME_DEFAULT}:${port ?? PORT_DEFAULT}`)
		}
		catch (error) {
			console.error(error)
		}
	}
	catch {
		console.log(cliHelp())
	}
}

// #endregion

main()
