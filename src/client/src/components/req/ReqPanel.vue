<template>
<div class="artisan-req-panel full-width grow column no-wrap overflow-hidden">
	<div class="url-field-pair row no-wrap" :class="{'cursor-not-allowed': req$.fetching}">
		<http-method-field
			class="no-shrink"
			ref="method-input"
			:disable="req$.fetching || req$.params.textMode"
			:offset-x="4"
			v-model="req$.method"
			@blur="req$.method = 'GET'"
			@enter="urlInput$?.focus()"
		/>
		<q-separator vertical/>
		<req-url-field
			class="grow"
			ref="url-input"
			:valid="req$.urlValid"
			:fetching="req$.fetching"
			:disable="req$.params.textMode"
			v-model="req$.url"
			@paste="pasteCurl($event)"
			@start="$emit('send', undefined)"
			@stop="req$.fetching = false"
		/>
	</div>
	<q-separator/>
	<div class="grow column no-wrap overflow-auto">
		<div class="grow column no-wrap">
			<q-tabs
				breakpoint="0"
				mobile-arrows
				:align="$q.screen.width >= 600 ? 'left' : 'justify'"
				narrow-indicator inline-label no-caps
				v-model="req$.tab"
			>
				<q-tab
					icon="mdi-magnify"
					label="Params"
					:alert="!!(req$.params.textMode || req$.params.rows.length)"
					:alert-icon="req$.params.textMode ? 'mdi-content-save-edit-outline' : undefined"
					name="params"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-table"
					label="Headers"
					:alert="!!(req$.headers.textMode || req$.headers.rows.length)"
					:alert-icon="req$.headers.textMode ? 'mdi-content-save-edit-outline' : undefined"
					name="headers"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-text-box-outline"
					label="Body"
					:alert="req$.body.type !== ReqBodyType.NONE"
					:alert-icon="req$.body.formTextMode ? 'mdi-content-save-edit-outline' : undefined"
					name="body"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-tune-variant"
					label="Options"
					:alert="!!(req$.options.includeCredentials ||
						req$.options.integrityHashes.value && !req$.options.integrityHashes.disable ||
						req$.options.curlProxy.server.value && !req$.options.curlProxy.server.disable)"
					name="options"
					:ripple="ripple$"
				/>
			</q-tabs>
			<q-separator/>
			<div class="grow column no-wrap" :class="{'cursor-not-allowed': req$.fetching}">
				<q-tab-panels
					class="grow bg-background text-text"
					:inert="req$.fetching"
					v-model="req$.tab"
				>
					<q-tab-panel class="overflow-hidden q-pa-none" name="params">
						<kv-table
							class="fit"
							v-model:text-mode="req$.params.textMode"
							v-model:text-value="req$.params.textValue"
							v-model="req$.params.rows"
							v-model:pagination="req$.params.pagination"
						/>
					</q-tab-panel>
					<q-tab-panel class="overflow-hidden q-pa-none" name="headers">
						<kv-table
							class="fit"
							v-model:text-mode="req$.headers.textMode"
							v-model:text-value="req$.headers.textValue"
							v-model="req$.headers.rows"
							v-model:pagination="req$.headers.pagination"
						/>
					</q-tab-panel>
					<q-tab-panel class="overflow-hidden q-pa-none" name="body">
						<req-body-form
							class="fit"
							v-model:type="req$.body.type"
							v-model:form-text-mode="req$.body.formTextMode"
							v-model:form-text-value="req$.body.formTextValue"
							v-model:form-pagination="req$.body.formPagination"
							v-model:file-accept="req$.body.fileAccept"
							v-model:text-lang="req$.body.textLang"
							v-model="req$.body.value"
						/>
					</q-tab-panel>
					<q-tab-panel class="overflow-hidden q-pa-none" name="options">
						<req-options-form
							class="fit"
							:disable-extract="disableExtract$"
							:table-height="reqTabHeight$"
							v-model="req$.options"
							@extract-curl-proxy="extractCurlProxy()"
						/>
					</q-tab-panel>
				</q-tab-panels>
			</div>
		</div>
		<q-resize-observer debounce="0" @resize="reqTabHeight$ = $event.height"/>
	</div>
</div>
</template>

<script setup lang="ts">
import {computed, ref, useTemplateRef} from 'vue'
import {useMagicKeys, whenever} from '@vueuse/core'
import {
	CurlService,
	HttpMethodField,
	KvTable,
	ReqBodyForm,
	ReqOptionsForm,
	ReqUrlField,
	ReqBodyType,
	ReqService,
	useReqStore,
	useUiStore,
} from '@'

const
	{req$} = useReqStore(),
	{notify, ripple$} = useUiStore(),

	methodInput$ = useTemplateRef<typeof HttpMethodField>('method-input'),
	urlInput$ = useTemplateRef<typeof ReqUrlField>('url-input'),
	reqTabHeight$ = ref(0),

	$emit = defineEmits<{
		'send': ['repeat' | undefined],
	}>(),

	keys$ = useMagicKeys(),
	watcherAltM = whenever(keys$.alt_m!, () => methodInput$.value!.focus()),
	watcherAltU = whenever(keys$.alt_u!, () => urlInput$.value!.focus()),
	watcherAltP = whenever(keys$.alt_p!, () => req$.value.tab = 'params'),
	watcherAltH = whenever(keys$.alt_h!, () => req$.value.tab = 'headers'),
	watcherAltB = whenever(keys$.alt_b!, () => req$.value.tab = 'body'),
	watcherAltO = whenever(keys$.alt_o!, () => req$.value.tab = 'options'),

	disableExtract$ = computed(() =>
		!req$.value.urlValid || !req$.value.params.rows
			.some(({disable, key, value}) => !disable && key === 'url' && value)
	)

function pasteCurl(event: ClipboardEvent) {
	try {
		const text = event.clipboardData?.getData('text')
		if (text?.trim().match(/^curl(\s|\\)/)) {
			const req = req$.value
			Object.assign(req, CurlService.fromCurl(text).patchView(req).strip('id'))
			event.preventDefault()
		}
	}
	catch (error) {
		console.error(error)
		notify('Error pasting cURL command')
	}
}

function extractCurlProxy() {
	try {
		ReqService.extractCurlProxy(req$.value)
	}
	catch (error) {
		console.error(error)
		notify('Error parsing cURL Proxy URL')
	}
}
</script>
