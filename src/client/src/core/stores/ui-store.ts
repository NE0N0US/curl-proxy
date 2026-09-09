import {readonly, ref} from 'vue'
import {type QDialogOptions, type QNotifyCreateOptions, type QVueGlobals} from 'quasar'
import {createSharedComposable, useLocalStorage} from '@vueuse/core'

export const useUiStore = createSharedComposable(() => {
	const dialogs$ = ref(0)
	let $q: QVueGlobals
	const store = {
		set $q(value: QVueGlobals) {
			$q = value
		},

		dialogs$: readonly(dialogs$),
		dialog(options: QDialogOptions) {
			dialogs$.value++
			return $q.dialog(options)
				.onDismiss(() => dialogs$.value--)
		},

		notify(options: string | QNotifyCreateOptions) {
			return $q.notify(options)
		},

		ripple$: ref<boolean | Object | undefined>(
			Object.freeze({early: true, center: false})
		),

		colorScheme$: useLocalStorage('color-scheme', 'auto'),
	}
	return store
})
