<template>
<div class="artisan-req-body-form column no-wrap">
	<div class="q-px-md q-py-xs column">
		<q-option-group
			class="non-selectable"
			inline
			v-model="type$"
			:options="bodyTypes$"
			color="text"
			@update:model-value="resetValue($event, type$)"
		/>
	</div>
	<q-separator v-if="value$ !== null || type$ === ReqBodyType.FILE"/>
	<template v-if="type$ === ReqBodyType.TEXT && typeof value$ === 'string'">
		<code-editor
			v-model:lang="<any>textLang$"
			v-model="<string>value$"
		/>
	</template>
	<template v-else-if="type$ === ReqBodyType.FILE && (value$ === null || value$ instanceof FileClass)">
		<div class="url-field-pair row no-wrap">
			<suggested-input
				class="no-shrink"
				icon="mdi-filter-outline"
				label="Accept"
				:placeholder="FILE_ACCEPT_OPTIONS[0]!.value"
				input-class="artisan-mono"
				:options="FILE_ACCEPT_OPTIONS"
				:offset-x="4"
				v-model="fileAccept$"
				@blur="fileAccept$ ||= FILE_ACCEPT_OPTIONS[0]!.value"
				@enter="fileInput$?.focus()"
			/>
			<q-separator vertical/>
			<file-input-field
				class="grow"
				ref="file-input"
				:accept="fileAccept$"
				v-model="value$"
			/>
		</div>
		<div class="no-height">
			<q-separator/>
		</div>
	</template>
	<kv-table
		v-else-if="[ReqBodyType.FORM_URLENCODED, ReqBodyType.FORM_MULTIPART].includes(type$) && Array.isArray(value$)"
		class="grow"
		:multipart-form="type$ === ReqBodyType.FORM_MULTIPART"
		:table-height="formTableHeight"
		v-model:text-mode="formTextMode$"
		v-model:text-value="formTextValue$"
		v-model="<ReqKV[]>value$"
		v-model:pagination="formPagination$"
	>
		<q-btn
			:icon="type$ === ReqBodyType.FORM_URLENCODED ? 'mdi-file-multiple-outline' : 'mdi-file-remove-outline'"
			flat round color="text" :ripple="ripple$"
			@click.passive="toggleFormType()"
		>
			<q-tooltip :delay="300" transition-duration="0">
				{{type$ === ReqBodyType.FORM_URLENCODED ? 'Add Files' : 'Remove Files'}}
			</q-tooltip>
		</q-btn>
	</kv-table>
</div>
</template>

<style scoped lang="scss">
.artisan-file-input-field :deep(.q-file__dnd) {
	outline-offset: 3px !important;
	right: 3px;
	left: -8px;
}
</style>

<script setup lang="ts">
import {computed, useTemplateRef} from 'vue'
import {
	AppService,
	CodeEditor,
	FileInputField,
	KvTable,
	ReqBodyType,
	type ReqBody,
	type ReqKV,
	SuggestedInput,
	useUiStore,
} from '@'

const
	{ripple$} = useUiStore(),

	FileClass = File,

	fileInput$ = useTemplateRef<typeof FileInputField>('file-input'),

	$props = defineProps<{
		formTableHeight?: number | undefined,
	}>(),

	type$ = defineModel<ReqBodyType>('type', {required: true}),

	bodyTypes$ = computed(() => [
		{label: 'None', value: ReqBodyType.NONE},
		{label: 'Text', value: ReqBodyType.TEXT},
		{label: 'File', value: ReqBodyType.FILE},
		{label: 'Form', value: type$.value === ReqBodyType.FORM_MULTIPART
			? ReqBodyType.FORM_MULTIPART : ReqBodyType.FORM_URLENCODED},
	]),

	formTextMode$ = defineModel<boolean>('form-text-mode', {required: true}),
	formTextValue$ = defineModel<string>('form-text-value', {required: true}),

	formPagination$ = defineModel<{
		sortBy?: string | null,
		descending?: boolean,
		filter?: Partial<{query: string, regex: boolean}> | undefined,
		rowsPerPage: number,
		page: number,
	}>('form-pagination', {required: true}),

	FILE_ACCEPT_OPTIONS = AppService.freeze([
		{icon: 'mdi-file-multiple-outline', label: 'All files', value: '*/*'},
		{icon: 'mdi-image-outline', label: 'Images', value: 'image/*'},
		{icon: 'mdi-video-outline', label: 'Videos', value: 'video/*'},
		{icon: 'mdi-music-note-outline', label: 'Audio', value: 'audio/*'},
	]),

	fileAccept$ = defineModel<string>('file-accept', {required: true}),

	textLang$ = defineModel<null | string>('text-lang', {required: true}),

	value$ = defineModel<ReqBody>()

function resetValue(type: ReqBodyType, oldType: ReqBodyType) {
	formTextMode$.value = false
	formTextValue$.value = ''
	if (type !== oldType)
		switch(type) {
			case ReqBodyType.NONE:
			case ReqBodyType.FILE:
				value$.value = null
				break
			case ReqBodyType.TEXT:
				value$.value = ''
				break
			case ReqBodyType.FORM_URLENCODED:
			case ReqBodyType.FORM_MULTIPART:
				value$.value = [ReqBodyType.FORM_URLENCODED, ReqBodyType.FORM_MULTIPART].includes(oldType)
					? (value$.value as ReqKV[]).filter(({value}) => !Array.isArray(value))
					: []
				break
		}
	return type
}

function toggleFormType() {
	const type = type$.value
	type$.value = resetValue(
		type === ReqBodyType.FORM_URLENCODED ? ReqBodyType.FORM_MULTIPART : ReqBodyType.FORM_URLENCODED,
	type)
}
</script>
