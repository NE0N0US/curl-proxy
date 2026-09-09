import {proxyDebugResponse, vercelConfig} from '../src/lib/proxy/config.ts'

export default {
	fetch: (req: Request) => proxyDebugResponse(req, vercelConfig)
}
