import {createSharedComposable} from '@vueuse/core'

import {useCssVarStore} from '@'

export const useAppPersistence = createSharedComposable(() => {
	const persistence = {
		cssVarStore: useCssVarStore(),
	}

	return persistence
})
