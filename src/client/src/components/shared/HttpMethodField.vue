<template>
<div class="artisan-http-method-field">
	<q-input
		class="fit" :class="{'cursor-not-allowed': disable}"
		spellcheck="false" autocomplete="off"
		:inert="disable"
		ref="input"
		label="Method"
		:shadow-text="method$ ? ' ' : (placeholder ?? METHODS[0]!.value)"
		v-model="method$"
		:disable="disable"
		borderless hide-bottom-space dense
		@blur="$emit('blur')"
		@keydown.enter.passive="$emit('enter')"
	>
		<template #prepend>
			<q-icon :name="methodIcon(method$) ?? 'mdi-console-line'" color="text"/>
		</template>
		<template #after>
			<q-btn
				icon="mdi-chevron-down"
				:disable="disable"
				flat round color="text" :ripple="ripple$"
			>
				<q-menu
					translate="no"
					auto-close
					:offset="[width$ - 40 - (offsetX ?? 0), 0]"
					max-width="100dvw"
					transition-show="none" transition-hide="none"
					@before-show="methodLast$ = method$"
				>
					<q-list
						class="non-selectable"
						:style="{'min-width': width$ - 2 + 'px'}"
						padding
					>
						<menu-item
							v-for="method of METHODS" :key="method.value"
							:icon="method.icon"
							:label="method.value"
							@click="method$ = method.value"
						>
							<q-icon v-if="methodLast$ === method.value" name="mdi-check" color="text"/>
						</menu-item>
					</q-list>
				</q-menu>
			</q-btn>
		</template>
	</q-input>
	<q-resize-observer debounce="0" @resize="width$ = $event.width"/>
</div>
</template>

<script setup lang="ts">
import {ref, useTemplateRef, watch} from 'vue'
import {type QInput} from 'quasar'
import {AppService, MenuItem, useUiStore} from '@'

const
	{ripple$} = useUiStore(),

	input$ = useTemplateRef<QInput>('input'),
	width$ = ref(0),

	$props = defineProps<{
		disable?: boolean | undefined,
		/** right padding */
		offsetX: number,
		placeholder?: string | undefined,
	}>(),

	$emit = defineEmits<{
		blur: [],
		enter: [],
	}>(),

	method$ = defineModel<string>({required: true}),

	/** prevents layout shift */
	methodLast$ = ref(''),

	watcherUppercase = watch(method$, value =>
		method$.value = value.replace(/[^a-zA-Z]/g, '').toUpperCase(),
	{immediate: true}),

	METHODS = AppService.freeze([
		{icon: 'mdi-download', value: 'GET'},
		{icon: 'mdi-upload', value: 'POST'},
		{icon: 'mdi-file-replace-outline', value: 'PUT'},
		{icon: 'mdi-file-edit-outline', value: 'PATCH'},
		{icon: 'mdi-trash-can-outline', value: 'DELETE'},
		{icon: 'mdi-arrow-down-bold-outline', value: 'HEAD'},
		{icon: 'mdi-help-circle-outline', value: 'OPTIONS'},
	])

function methodIcon(value: string) {
	return METHODS.find(method => method.value === value)?.icon
}

defineExpose({
	focus: () => input$.value?.focus(),
	select: () => input$.value?.select(),
})
</script>
