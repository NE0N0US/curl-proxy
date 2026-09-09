<template>
<div class="artisan-suggested-input">
	<q-input
		v-bind="$attrs"
		class="fit" :class="{'cursor-not-allowed': disable}"
		spellcheck="false" autocomplete="off"
		:inert="disable"
		ref="input"
		:label="label"
		:shadow-text="value$ ? ' ' : (placeholder ?? options[0]!.value)"
		v-model="value$"
		:disable="disable"
		borderless hide-bottom-space dense
		:input-class="inputClass"
		@blur="$emit('blur')"
		@keydown.enter.passive="$emit('enter')"
	>
		<template #prepend>
			<q-icon :name="optionIcon(value$) ?? icon ?? 'mdi-pencil-outline'" color="text"/>
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
					@before-show="valueLast$ = value$"
				>
					<q-list
						class="non-selectable"
						:style="{'min-width': width$ - 2 + 'px'}"
						padding
					>
						<menu-item
							v-for="option of options" :key="option.value"
							:icon="option.icon"
							:label="option.label"
							@click="value$ = option.value"
						>
							<q-icon v-if="valueLast$ === option.value" name="mdi-check" color="text"/>
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
import {ref, useAttrs, useTemplateRef} from 'vue'
import {type QInput, type VueClassProp} from 'quasar'
import {MenuItem, useUiStore} from '@'

const
	{ripple$} = useUiStore(),

	input$ = useTemplateRef<QInput>('input'),
	width$ = ref(0),

	$props = defineProps<{
		icon?: string | undefined,
		label: string,
		placeholder?: string | undefined,
		inputClass?: VueClassProp | undefined,
		options: readonly {icon: string, label: string, value: string}[],
		/** right padding */
		offsetX?: number | undefined,
		disable?: boolean | undefined,
	}>(),

	$attrs = useAttrs(),

	$emit = defineEmits<{
		blur: [],
		enter: [],
	}>(),

	value$ = defineModel<string>({required: true}),

	/** prevents layout shift */
	valueLast$ = ref('')

function optionIcon(value: string) {
	return $props.options.find(option => option.value === value)?.icon
}

defineExpose({
	focus: () => input$.value?.focus(),
	select: () => input$.value?.select(),
})
</script>
