import {readonly, ref} from 'vue'
import {useEventListener} from '@vueuse/core'

export function useOnline() {
	const online$ = ref(navigator.onLine)
	useEventListener(
		window,
		['online', 'offline'],
		() => online$.value = navigator.onLine
	)
	return readonly(online$)
}
