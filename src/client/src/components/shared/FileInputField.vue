<template>
<div class="artisan-file-input-field min-width">
	<q-file
		v-bind="$attrs"
		class="fit overflow-hidden"
		ref="input"
		name="file"
		:multiple="Array.isArray(value$)"
		:label="hideLabel ? undefined : Array.isArray(value$) ? 'Files' : 'File'"
		v-model="value$"
		borderless hide-bottom-space dense
		:rules="required ? [value => Array.isArray(value) ? !!value.length : !!value] : []"
		@update:model-value="input$?.blur()"
		@focus="input$!.hasError ? $emit('error') : undefined"
	>
		<template #file="{index}">
			<div
				v-if="!index"
				class="file-value-row fit row no-wrap items-center justify-between text-text"
				translate="no"
			>
				<span class="ellipsis">
					<span v-if="names$.length <= 1">
						{{names$[0]}}
					</span>
					<template v-else>
						Files ({{names$.length}})
					</template>
				</span>
				<span class="file-value-size text-no-wrap">
					{{AppService.formatDataSize(size$)}}
				</span>
			</div>
		</template>
		<template #after>
			<q-btn
				v-if="!$slots.after"
				icon="mdi-file-remove-outline"
				:disable="!value$ || Array.isArray(value$) && !value$.length"
				flat round color="text" :ripple="ripple$"
				@click.passive="value$ = Array.isArray(value$) ? [] : null"
			>
				<q-tooltip
					v-if="!(!value$ || Array.isArray(value$) && !value$.length)"
					:delay="300" transition-duration="0"
				>
					Remove File
				</q-tooltip>
			</q-btn>
			<slot v-else name="after"/>
		</template>
		<q-tooltip
			v-if="Array.isArray(value$) && value$.length > 1"
			:ref="tooltip => tooltipElement$ = <HTMLElement>(<QTooltip>tooltip)?.contentEl"
			:delay="300"
			:model-value="tooltip$ || !outsideTooltip$"
			@update:model-value="tooltip$ = $event"
			anchor="bottom left" self="top left" :offset="[13, 0]"
			transition-show="none" transition-hide="none"
		>
			<div class="column no-wrap gap-sm" translate="no">
				<span v-for="name of names$" :key="name">
					{{name}}
				</span>
			</div>
		</q-tooltip>
	</q-file>
</div>
</template>

<style scoped lang="scss">
.file-value-row {
	gap: 6px;

	.file-value-size {
		opacity: var(--opacity-disabled);
	}
}

.q-file {
	:deep(.q-field__label) {
		top: 12px;
	}

	:deep(.q-field__append) {
		display: none;
	}
}
</style>

<script setup lang="ts">
import {computed, ref, shallowRef, useAttrs, useTemplateRef} from 'vue'
import {type QFile, type QTooltip} from 'quasar'
import {useMouseInElement} from '@vueuse/core'
import {AppService, useUiStore} from '@'

const
	{ripple$} = useUiStore(),

	input$ = useTemplateRef<typeof QFile>('input'),

	$props = defineProps<{
		hideLabel?: boolean | undefined,
		required?: boolean | undefined,
	}>(),

	$attrs = useAttrs(),

	$emit = defineEmits<{
		'error': [],
	}>(),

	value$ = defineModel<null | File | File[]>({required: true}),

	names$ = computed(() => {
		const value = value$.value
		return Array.isArray(value) && value.length > 1
			? value
				.map(({name}) => name)
				.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
			: [((value as File[])[0] ?? value as File)?.name ?? '']
	}),

	size$ = computed(() => {
		const value = value$.value
		return Array.isArray(value)
			? value.reduce((sum, {size}) => sum + size, 0)
			: value?.size ?? 0
	}),

	tooltipElement$ = shallowRef<HTMLElement>(),
	{isOutside: outsideTooltip$} = useMouseInElement(tooltipElement$),

	tooltip$ = ref(false)

defineExpose({
	focus: () => input$.value?.focus(),
	select: () => input$.value?.pickFiles(),
})
</script>
