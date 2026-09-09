<template>
<q-layout
	class="artisan-main-layout bg-background text-text"
	:inert="!!dialogs$"
	view="lHr lpR lFr"
>
	<sidenav :breakpoint="SIDENAV_BP" v-model="drawer$"/>
	<q-page-container>
		<main
			class="max-width-md max-width-separators min-height-screen column no-wrap"
			:inert="drawer$ && $q.screen.width < SIDENAV_BP"
		>
			<splitter-accordion class="grow" v-model="collapse$">
				<template #header-start>
					<q-toolbar class="non-selectable">
						<q-btn
							:icon="collapse$ === 'start' ? 'mdi-chevron-down' : 'mdi-chevron-up'"
							flat round :ripple="ripple$"
							@click.passive="collapse$ = collapse$ === 'start' ? null : 'start'"
						/>
						<q-toolbar-title>Request</q-toolbar-title>
						<req-toolbar-actions @send="send($event)">
							<q-btn
								v-if="$q.screen.width < SIDENAV_BP"
								icon="mdi-tab"
								flat round :ripple="ripple$"
								@click.passive="drawer$ = true"
							>
								<q-tooltip :delay="300" transition-duration="0">
									Tabs
								</q-tooltip>
							</q-btn>
						</req-toolbar-actions>
					</q-toolbar>
				</template>
				<template #content-start>
					<req-panel @send="send($event)"/>
				</template>
				<template #header-end>
					<q-toolbar class="non-selectable">
						<q-btn
							:icon="collapse$ === 'end' ? 'mdi-chevron-down' : 'mdi-chevron-up'"
							flat round :ripple="ripple$"
							@click.passive="collapse$ = collapse$ === 'end' ? null : 'end'"
						/>
						<q-toolbar-title>Response</q-toolbar-title>
						<res-toolbar-actions/>
					</q-toolbar>
				</template>
				<template #content-end>
					<res-panel/>
				</template>
			</splitter-accordion>
		</main>
	</q-page-container>
</q-layout>
</template>

<style scoped lang="scss">
.q-layout {
	min-height: 0 !important;

	:deep(.q-drawer__opener) {
		display: none;
	}
}
</style>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useRoute} from 'vue-router'
import {useEventListener, useMagicKeys, useTitle, whenever} from '@vueuse/core'
import {toUnicode} from 'punycode'
import {
	AboutDialog,
	AppService,
	CookiesDialog,
	CurlService,
	ExamplesDialog,
	ReqBodyType,
	ReqPanel,
	ReqToolbarActions,
	ResPanel,
	ResToolbarActions,
	Sidenav,
	SplitterAccordion,
	useReqStore,
	useUiStore,
} from '@'

const
	$route = useRoute(),
	{req$, touched$} = useReqStore(),
	{dialog, dialogs$, notify, ripple$} = useUiStore(),

	drawer$ = ref(false),
	collapse$ = ref<null | 'start' | 'end'>(null),

	keys$ = useMagicKeys(),
	watcherAltCtrlUp = whenever(keys$.alt_ctrl_arrowup!, () => collapse$.value = 'end'),
	watcherAltCtrlDown = whenever(keys$.alt_ctrl_arrowdown!, () => collapse$.value = 'start'),

	title$ = useTitle(() => 'URL Artisan' + (req$.value.urlValid ? `: ${
		decodeURI(toUnicode(new URL(
			AppService.resolveUrl(req$.value.url)
		).hostname))
	}` : '')),

	listenerPreventUnload = useEventListener(window, 'beforeunload', event => {
		if (touched$.value) {
			event.preventDefault()
			event.returnValue = true
		}
	}),

	SIDENAV_BP = 1_800

onMounted(() => {
	const
		{curl: curlParams, open: openParams} = $route.query,
		curl = Array.isArray(curlParams) ? curlParams[0] : curlParams,
		open = Array.isArray(openParams) ? openParams[0] : openParams
	if (curl?.trim().match(/^curl(\s|\\)/))
		try {
			const req = req$.value
			Object.assign(req, CurlService.fromCurl(curl).patchView(req).strip('id'))
			if (req.urlValid)
				send()
		}
		catch (error) {
			console.error(error)
			notify('Error pasting cURL command')
		}
	if (open)
		switch (open) {
			case 'cookies':
				dialog({component: CookiesDialog})
				break
			case 'examples':
				dialog({component: ExamplesDialog})
				break
			case 'about':
				dialog({component: AboutDialog})
				break
		}
	const url = new URL(location.href)
	url.searchParams.delete('curl')
	url.searchParams.delete('open')
	window.history.pushState({}, '', url)
	setTimeout(() => touched$.value = false)
})

function send(command?: 'repeat') {
	const
		req = req$.value,
		hasBody = req.body.type !== ReqBodyType.NONE,
		hasCurlProxy = !!req.options.curlProxy.server.value && !req.options.curlProxy.server.disable,
		hasCurlProxyBody = hasCurlProxy && req.options.curlProxy.body.type !== ReqBodyType.NONE,
		method = hasCurlProxy ? (req.options.curlProxy.method || req.method) : req.method
	if (['GET', 'OPTIONS'].includes(method) && (hasBody || hasCurlProxyBody))
		notify(method + ' request cannot have a body')
	else {
		req.fetchRepeat = command === 'repeat'
		req.fetching = true
	}
}
</script>
