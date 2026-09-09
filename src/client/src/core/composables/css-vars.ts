import {readonly, ref} from 'vue'
import {useMutationObserver} from '@vueuse/core'

export function useCssVars(nameOrNames: string[] | string, target = document.documentElement) {
	const
		names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames],
		values$ = ref<Record<string, string>>({}),
		update = () => {
			const styles = getComputedStyle(target)
			values$.value = Object.fromEntries(names.map(name =>
				[name, styles.getPropertyValue(name).trim()]
			))
		}
	update()
	useMutationObserver(target, update, {
		attributes: true,
		attributeFilter: ['class', 'style'],
	})
	return readonly(values$)
}
