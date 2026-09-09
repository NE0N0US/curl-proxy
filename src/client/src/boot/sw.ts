const swRegistration = import.meta.env.PROD ? await initSw('./service-worker.js', './') : undefined

async function getSwRegistration(swContainer: ServiceWorkerContainer, scriptUrl: string, scope: string) {
	if (!swContainer.controller) {
		const url = new URL(location.href)
		url.search = ''
		url.hash = ''
		const
			registration = await swContainer.register(scriptUrl, {scope}),
			worker = registration.active ?? registration.waiting ?? registration.installing
		if (worker?.state !== 'activated')
			await new Promise<void>(resolve => worker?.addEventListener('statechange', () => {
				if (worker.state === 'activated')
					resolve()
			}))
		// enable
		location.reload()
		await new Promise(() => {})
		return registration
	}
	else
		return await swContainer.getRegistration()
}

async function initSw(scriptUrl: string, scope: string) {
	const swContainer = navigator.serviceWorker
	if (swContainer)
		try {
			let swRegistration = await getSwRegistration(swContainer, scriptUrl, scope)
			if (swRegistration) {
				try {
					swRegistration = await swRegistration.update()
				}
				catch (error) {
					console.error('Error updating service worker', error)
				}
				return swRegistration
			}
			else
				console.error('Unable to update service worker')
		}
		catch (error) {
			console.error('Error initializing service worker', error)
		}
	else
		console.error('Unable to initialize service worker')
}
