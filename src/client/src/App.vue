<template>
  <router-view/>
</template>

<script setup lang="ts">
import {computed, onErrorCaptured, watch} from 'vue'
import {useQuasar} from 'quasar'
import {useEventListener, useFavicon} from '@vueuse/core'
import {useAppPersistence, useCssVars, useUiStore} from '@'

// https://vuejs.org/api/options-lifecycle.html#errorcaptured
onErrorCaptured((error, _component, info) => {
	console.error(info, error)
	return false
})

const
	listenerPreventLayoutDrag = useEventListener(document.documentElement, 'dragstart', (event: DragEvent) => {
		const
			selection = document.getSelection(),
			{commonAncestorContainer} = selection?.rangeCount ? selection?.getRangeAt(0) ?? {} : {},
			selectedText = window.getSelection()?.toString()
		if (commonAncestorContainer === document.body
			|| !selectedText
			|| selectedText.match(/^(?:[\r\n\t]\s*)|(?:\s*[\r\n\t])$/g)
			&& !['textarea', 'input'].includes((event.target as Node)?.nodeName?.toLowerCase())
		)
			event.preventDefault()
	}),

	persistence = useAppPersistence(),
	{colorScheme$} = Object.assign(useUiStore(), {$q: useQuasar()}),

	watcherColorScheme = watch(colorScheme$, (value, oldValue) =>
		document.documentElement.classList.replace('artisan-' + oldValue, 'artisan-' + value)
	),

	colors$ = useCssVars(['--color-background', '--color-text', '--q-primary']),

	watcherThemeColor = watch(colors$, value => {
		let meta = document.querySelector('meta[name="theme-color"]')
		if (!meta) {
			meta = document.createElement('meta')
			meta.setAttribute('name', 'theme-color')
			document.head.appendChild(meta)
		}
		meta.setAttribute('content', value['--color-background']!)
	}),

	FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path d="M21.3333 0H2.6667A2.6667 2.6667 90 00-0 2.6667V21.3333A2.6667 2.6667 90 002.6667 24H21.3333A2.6667 2.6667 90 0024 21.3333V2.6667A2.6667 2.6667 90 0021.3333-0" fill="black"/>
		<path d="M14.5867 15.7467c.84-.84 1.3066-1.96 1.3066-3.16s-.4666-2.32-1.3066-3.1734c-.44-.4266-1.2134-.44-1.6534 0-.2266.2267-.3466.52-.3466.8267 0 .32.12.6133.3466.8267.4.4133.64.9333.64 1.52 0 .5733-.24 1.12-.64 1.5333L10 17.04c-.8133.8267-2.2267.8267-3.04 0-.4133-.4133-.64-.9467-.64-1.52s.2267-1.12.64-1.52l.5333-.5467-.0666-.2c-.2134-.5866-.32-1.2533-.3067-1.92l.0133-.8-1.8 1.8134c-1.7733 1.76-1.7733 4.6 0 6.32C6.1867 19.56 7.3333 20 8.48 20s2.2933-.44 3.16-1.3333l2.9467-2.92" fill="white"/>
		<path d="M18.6667 11.6533C19.5333 10.8 20 9.68 20 8.48c0-1.2-.4667-2.32-1.3333-3.1467-1.72-1.76-4.56-1.7733-6.3067 0l-2.9467 2.92C7.6667 10 7.6667 12.84 9.4133 14.5867c.2267.2266.5334.3333.8267.3333.3067 0 .6-.1067.8267-.3333.2266-.2134.3466-.5067.3466-.8267s-.12-.6133-.3466-.8267c-.4-.4133-.64-.9333-.64-1.52 0-.5733.24-1.12.64-1.52L14 6.96c.8-.8133 2.2267-.8267 3.04 0 .4133.4133.64.9467.64 1.52S17.4533 9.6 17.04 10l-.5333.56.0666.1867c.2134.5866.32 1.2533.3067 1.92v.8l1.7867-1.8134Z" fill="white"/>
	</svg>`.replace(/[\n\t]/g, ''),

	favicon$ = useFavicon(computed(() => `data:image/svg+xml,${encodeURIComponent(
		FAVICON
			.replaceAll('black', colors$.value['--color-background']!)
			.replaceAll('white', colors$.value['--color-text']!)
	)}`))
</script>
