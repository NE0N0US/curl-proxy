<template>
<div class="artisan-req-url-field">
	<q-input
		class="fit"
		:class="{
			'cursor-not-allowed': fetching || disable,
			'shadow-text-always': expanded,
		}"
		spellcheck="false" autocomplete="off"
		inputmode="url" enterkeyhint="send"
		:inert="fetching || disable"
		ref="input"
		:label="expanded ? undefined : 'URL'"
		:shadow-text="url$ ? ' ' : 'Full, protocol-less, or relative URL'"
		:autogrow="expanded"
		v-model="url$"
		:disable="fetching || disable"
		borderless hide-bottom-space dense
		input-class="artisan-mono"
		@keydown.enter.passive="allowSend$ ? $emit('start') : null"
	>
		<template v-if="!expanded" #after>
			<q-btn
				:icon="fetching ? 'mdi-stop' : 'mdi-send'"
				:disable="!fetching && !allowSend$ || disable"
				flat round color="text":ripple="ripple$"
				@click.passive="fetching ? $emit('stop') : $emit('start')"
			>
				<q-tooltip
					v-if="!(!fetching && !allowSend$ || disable)"
					:delay="300" transition-duration="0"
				>
					{{fetching ? 'Stop' : 'Send'}}
				</q-tooltip>
			</q-btn>
		</template>
	</q-input>
</div>
</template>

<script setup lang="ts">
import {computed, useTemplateRef} from 'vue'
import {type QInput} from 'quasar'
import {useEventListener} from '@vueuse/core'
import {useUiStore} from '@'

const
	{ripple$} = useUiStore(),

	input$ = useTemplateRef<QInput>('input'),

	$props = defineProps<{
		valid?: boolean | undefined,
		fetching?: boolean | undefined,
		disable?: boolean | undefined,
		expanded?: boolean | undefined,
	}>(),

	$emit = defineEmits<{
		paste: [event: ClipboardEvent],
		start: [value?: 'download' | 'repeat'],
		stop: [],
	}>(),

	url$ = defineModel<string>({required: true}),

	allowSend$ = computed(
		() => !!(url$.value && $props.valid && !$props.fetching && !$props.disable && !$props.expanded)
	),

	listenerPaste = useEventListener(() => input$.value?.nativeEl, 'paste', event => $emit('paste', event))

defineExpose({
	focus: () => input$.value?.focus(),
	select: () => input$.value?.select(),
})
</script>
