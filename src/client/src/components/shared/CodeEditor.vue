<template>
<div class="artisan-code-editor grow column no-wrap">
	<div v-if="!noLangOptions" class="q-px-md q-py-xs column">
		<q-option-group
			class="non-selectable"
			inline
			v-model="lang$"
			:options="LANGS"
			color="text"
		/>
	</div>
	<codemirror
		v-model="value$"
		:disabled="disable"
		:tab-size="tabSize ?? 4"
		:placeholder="placeholder
			?? ('Enter ' + (LANG_PLACEHOLDER[lang$ ?? ''] ?? 'text'))"
		:extensions="extensions$"
	/>
	<div
		v-if="!disable && <string>lang$ in langExtensions"
		class="q-pa-xs row no-wrap gap-xs"
	>
		<q-btn
			label="Prettify"
			icon="mdi-format-indent-increase"
			:disable="!value$"
			no-caps no-wrap flat rounded
			@click.passive="prettify()"
		/>
		<q-btn
			v-if="lang$ !== 'html'"
			label="Minify"
			icon="mdi-arrow-collapse-vertical"
			:disable="!value$"
			no-caps no-wrap flat rounded
			@click.passive="minify()"
		/>
	</div>
</div>
</template>

<style scoped lang="scss">
.artisan-code-editor:focus-visible {
	outline: none;
}

.v-codemirror :deep(.cm-editor) {
	flex-grow: 1;
}

.q-btn {
	min-height: 40px;
}
</style>

<script setup lang="ts">
import {computed} from 'vue'
import {Codemirror} from 'vue-codemirror'
import {highlightActiveLineGutter} from '@codemirror/view'
import {EditorView} from 'codemirror'
import {javascript} from '@codemirror/lang-javascript'
import {json} from '@codemirror/lang-json'
import {html} from '@codemirror/lang-html'
import {xml} from '@codemirror/lang-xml'
import {CodeService, hex, useUiStore} from '@'

const
	{notify} = useUiStore(),

	$props = defineProps<{
		noLangOptions?: boolean | undefined,
		disable?: boolean | undefined,
		tabSize?: number | undefined,
		placeholder?: string | undefined,
		noLineWrap?: boolean | undefined,
	}>(),

	LANGS = [
		{label: 'Plain Text', value: null},
		{label: 'JavaScript', value: 'javascript'},
		{label: 'JSON', value: 'json'},
		{label: 'HTML', value: 'html'},
		{label: 'XML', value: 'xml'},
	],

	langExtensions = {
		javascript: javascript(),
		json: json(),
		html: html(),
		xml: xml(),
		hex: hex(),
	},

	lang$ = defineModel<null | keyof typeof langExtensions>('lang', {default: null}),

	extensions$ = computed(() => {
		const lang = lang$.value
		return [
			...(lang !== null && lang in langExtensions) ? [langExtensions[lang]] : [],
			...$props.disable ? [] : [highlightActiveLineGutter()],
			...$props.noLineWrap ? [] : [EditorView.lineWrapping],
		]
	}),

	value$ = defineModel<string>({required: true}),

	LANG_PLACEHOLDER: any = {
		javascript: 'JavaScript code',
		json: 'JSON data',
		html: 'HTML code',
		xml: 'XML data',
	}

async function minify() {
	const lang = lang$.value ?? ''
	try {
		value$.value = await CodeService.minify(value$.value, lang)
	}
	catch (error) {
		console.error(error)
		notify('Error minifying ' + LANG_PLACEHOLDER[lang])
	}
}

async function prettify() {
	const lang = lang$.value ?? ''
	try {
		value$.value = await CodeService.prettify(value$.value, lang)
	}
	catch (error) {
		console.error(error)
		notify('Error prettifying ' + LANG_PLACEHOLDER[lang])
	}
}
</script>
