'use strict';

const
	STATIC_CACHE_NAME = 'artisan-static',

	STATIC_CACHE_URLS = Object.freeze([
		'./favicon.svg',
		'./index.html',
		'./manifest.json',
		'./',
		'./assets/index.css',
		'./assets/index.js',
		'./assets/materialdesignicons-webfont.woff',
		'./assets/materialdesignicons-webfont.woff2',
		'./fonts/roboto-flex/RobotoFlex-VariableFont_GRAD,XOPQ,XTRA,YOPQ,YTAS,YTDE,YTFI,YTLC,YTUC,opsz,slnt,wdth,wght.ttf',
		'./fonts/roboto-mono/RobotoMono-Italic-VariableFont_wght.ttf',
		'./fonts/roboto-mono/RobotoMono-VariableFont_wght.ttf',
	].map(resolveUrl)),

	debug = console.debug.bind(console)

function resolveUrl(requestOrUrl) {
	const url = new URL(requestOrUrl?.url ?? requestOrUrl, self.registration.scope)
	url.search = ''
	url.hash = ''
	return url.href
}

async function cacheStaticUrls() {
	try {
		await caches.delete(STATIC_CACHE_NAME)
		await (await caches.open(STATIC_CACHE_NAME)).addAll(STATIC_CACHE_URLS)
		debug('Installed or updated service worker')
	}
	catch (error) {
		debug('Error installing or updating service worker', error)
		throw error
	}
}

async function fetchThroughCache(requestOrUrl) {
	const
		url = resolveUrl(requestOrUrl),
		useCache = (url.startsWith('https://') || url.startsWith('http://')) &&
			(requestOrUrl?.method.toUpperCase() ?? 'GET') === 'GET' &&
			STATIC_CACHE_URLS.includes(url)
	try {
		const
			cache = !useCache || await caches.open(STATIC_CACHE_NAME),
			cachedResponse = (!useCache || await cache.match(url)) ?? true
		try {
			const response = !navigator.onLine && cachedResponse !== true || await fetch(requestOrUrl)
			if (useCache) {
				if (response !== true && (response.ok || response.status === 0))
					try {
						await cache.put(url, response.clone())
						debug('Cached ' + url)
					}
					catch (error) {
						debug('Error caching ' + url, error)
						throw error
					}
				else if (cachedResponse !== true) {
					debug('Using cache of ' + url)
					return cachedResponse
				}
			}
			return response
		}
		catch (error) {
			if (cachedResponse !== true) {
				if (useCache)
					debug('Using cache of ' + url)
				return cachedResponse
			}
			else {
				if (useCache)
					debug('Error getting ' + url, error)
				throw error
			}
		}
	}
	catch (error) {
		if (useCache)
			debug('Error getting ' + url, error)
		throw error
	}
}

self.addEventListener('install', event => event.waitUntil(
	cacheStaticUrls()
))

self.addEventListener('fetch', event => event.respondWith(
	fetchThroughCache(event.request)
))
