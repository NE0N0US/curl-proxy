<template>
<div class="artisan-req-options-form relative-position">
	<q-list class="non-selectable">
		<req-options-form-toggle
			icon="mdi-account-key-outline"
			label="Send Credentials"
			caption="Include cookies, TLS client certificates, Authorization and Proxy-Authorization headers"
			v-model="options$.includeCredentials"
		/>
	</q-list>
	<q-input
		class="list-item-input q-pa-toolbar"
		spellcheck="false" autocomplete="off"
		label="SRI Hashes"
		:shadow-text="options$.integrityHashes.value ? ' ' : 'sha512-<base64_digest> (space-separated)'"
		v-model="options$.integrityHashes.value"
		:disable="!!(options$.integrityHashes.value && options$.integrityHashes.disable)"
		borderless hide-bottom-space dense
		input-class="artisan-mono"
	>
		<template #prepend>
			<q-icon name="mdi-fingerprint" color="text"/>
		</template>
		<template #after>
			<q-checkbox
				v-if="options$.integrityHashes.value"
				v-model="options$.integrityHashes.disable"
				:true-value="false" :false-value="true"
				color="text"
			/>
		</template>
	</q-input>
	<q-list class="non-selectable">
		<menu-item
			class="q-pa-toolbar"
			icon="mdi-cog-transfer-outline"
			label="Extract qURL Proxy options from URL"
			caption="Parse qURL Proxy URL into original URL and options"
			:disable="disableExtract"
			@click="$emit('extractQurlProxy')"
		/>
	</q-list>
	<q-input
		class="list-item-input q-pa-toolbar"
		spellcheck="false" autocomplete="off"
		label="qURL Proxy Server"
		:shadow-text="options$.qurlProxy.server.value ? ' ' : 'https://qurl-proxy.vercel.app/'"
		v-model="options$.qurlProxy.server.value"
		:disable="!!(options$.qurlProxy.server.value && options$.qurlProxy.server.disable)"
		borderless hide-bottom-space dense
		input-class="artisan-mono"
	>
		<template #prepend>
			<a
				class="qurl-proxy-config"
				:inert="options$.qurlProxy.server.disable"
				:href="qurlProxyConfig$"
				target="_blank"
				@click.passive="$event.stopPropagation()"
			>
				<q-icon name="mdi-server-network-outline" color="text"/>
			</a>
		</template>
		<template #after>
			<q-checkbox
				v-if="options$.qurlProxy.server.value"
				v-model="options$.qurlProxy.server.disable"
				:true-value="false" :false-value="true"
				color="text"
			/>
		</template>
	</q-input>
	<q-list class="non-selectable">
		<q-expansion-item
			:model-value="!!options$.qurlProxy.server.value && !options$.qurlProxy.server.disable"
			header-class="hidden"
		>
			<q-separator/>
			<q-input
				class="list-item-input q-pa-toolbar"
				spellcheck="false" autocomplete="off"
				label="Extra URLs"
				:shadow-text="options$.qurlProxy.urls.value ? ' ' : 'Newline-separated URLs (full, protocol-less, or relative)'"
				autogrow
				v-model="options$.qurlProxy.urls.value"
				:disable="!!(options$.qurlProxy.urls.value && options$.qurlProxy.urls.disable)"
				borderless hide-bottom-space dense
				input-class="artisan-mono"
			>
				<template #prepend>
					<q-icon name="mdi-link-variant-plus" color="text"/>
				</template>
				<template #after>
					<q-checkbox
						v-if="options$.qurlProxy.urls.value"
						v-model="options$.qurlProxy.urls.disable"
						:true-value="false" :false-value="true"
						color="text"
					/>
				</template>
			</q-input>
			<q-list class="non-selectable">
				<req-options-form-toggle
					icon="mdi-lightning-bolt"
					label="Fastest"
					:caption="'Return first available response and its index in \x22X-Proxy-Responses\x22, abort others'"
					:disable="!options$.qurlProxy.urls.value || options$.qurlProxy.urls.disable"
					v-model="options$.qurlProxy.fastest"
				/>
			</q-list>
			<q-separator/>
			<template v-for="group, index of PROXY_OPTIONS" :key="index">
				<div v-if="group instanceof Object" class="proxy-options">
					<template v-for="{name, digits, icon, label, caption, options}, index of group" :key="name">
						<q-input
							v-if="!options?.length"
							class="list-item-input"
							spellcheck="false" autocomplete="off"
							:inputmode="digits ? 'numeric' : undefined"
							:label="label"
							:shadow-text="(<any>options$.qurlProxy)[name] ? ' ' : caption"
							:mask="digits ? numericMask(digits) : undefined"
							reverse-fill-mask
							unmasked-value
							v-model="(<any>options$.qurlProxy)[name]"
							:maxlength="digits ? numericMask(digits).length : undefined"
							borderless hide-bottom-space dense
						>
							<template #prepend>
								<q-icon :name="icon" color="text"/>
							</template>
						</q-input>
						<!-- .5 - workaround for fractional width: https://stackoverflow.com/q/39861687 -->
						<http-method-field
							v-else-if="name === 'method'"
							class="list-item-input"
							:offset-x="!index ? 6.5 : 12.5"
							:placeholder="caption"
							v-model="options$.qurlProxy.method"
						/>
						<suggested-input
							v-else
							class="list-item-input"
							spellcheck="false" autocomplete="off"
							:inputmode="digits ? 'numeric' : undefined"
							:icon="icon"
							:label="label"
							:placeholder="caption"
							:options="options"
							:offset-x="!index ? 6.5 : 12.5"
							:mask="digits ? numericMask(digits) : undefined"
							reverse-fill-mask
							unmasked-value
							v-model="(<any>options$.qurlProxy)[name]"
							:maxlength="digits ? numericMask(digits).length : undefined"
						/>
					</template>
				</div>
				<q-list v-else-if="group === 'RETRIES_PREVIEW'" class="non-selectable">
					<menu-item
						class="q-pa-toolbar"
						icon="mdi-information-outline"
						label="Retries Preview"
						:caption="retriesPreview$ || 'No delays'"
						disable
					/>
					<q-separator/>
				</q-list>
			</template>
			<q-list class="non-selectable">
				<req-options-form-toggle
					icon="mdi-rename-outline"
					label="Rename Response Headers"
					:caption="'To \x22X-Original-*\x22 before changes'"
					v-model="options$.qurlProxy.renResHeaders"
				/>
				<req-options-form-toggle
					icon="mdi-skip-forward"
					label="Skip Defaults"
					caption="Do not apply default header changes, except response safety behavior"
					v-model="options$.qurlProxy.skipDefaults"
				/>
			</q-list>
			<q-separator/>
			<q-tabs
				breakpoint="0"
				mobile-arrows
				align="left" narrow-indicator
				inline-label no-caps
				v-model="options$.qurlProxy.tab"
			>
				<q-tab
					icon="mdi-table"
					label="Headers"
					:alert="!!(options$.qurlProxy.headersAll.headers!.textMode
						|| options$.qurlProxy.headersAll.headers!.rows.length)"
					:alert-icon="options$.qurlProxy.headersAll.headers!.textMode
						? 'mdi-content-save-edit-outline' : undefined"
					name="headers"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-table-minus"
					label="Delete Headers"
					:alert="!!(options$.qurlProxy.headersAll.delHeaders!.textMode
						|| options$.qurlProxy.headersAll.delHeaders!.rows.length)"
					:alert-icon="options$.qurlProxy.headersAll.delHeaders!.textMode
						? 'mdi-content-save-edit-outline' : undefined"
					name="delHeaders"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-table"
					label="Response Headers"
					:alert="!!(options$.qurlProxy.headersAll.resHeaders!.textMode
						|| options$.qurlProxy.headersAll.resHeaders!.rows.length)"
					:alert-icon="options$.qurlProxy.headersAll.resHeaders!.textMode
						? 'mdi-content-save-edit-outline' : undefined"
					name="resHeaders"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-table-minus"
					label="Delete Response Headers"
					:alert="!!(options$.qurlProxy.headersAll.delResHeaders!.textMode
						|| options$.qurlProxy.headersAll.delResHeaders!.rows.length)"
					:alert-icon="options$.qurlProxy.headersAll.delResHeaders!.textMode
						? 'mdi-content-save-edit-outline' : undefined"
					name="delResHeaders"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-text-box-outline"
					label="Body"
					:alert="options$.qurlProxy.body.type !== ReqBodyType.NONE"
					:alert-icon="options$.qurlProxy.body.formTextMode
						? 'mdi-content-save-edit-outline' : undefined"
					name="body"
					:ripple="ripple$"
				/>
				<q-tab
					icon="mdi-text-box-edit-outline"
					label="Response Body"
					:alert="options$.qurlProxy.resBody.startsWith(ResBodyType.JAVASCRIPT + ':')
						? (options$.qurlProxy.resBody.length > ResBodyType.JAVASCRIPT.length + 1)
						: !!options$.qurlProxy.resBody"
					name="resBody"
					:ripple="ripple$"
				/>
			</q-tabs>
			<q-separator/>
			<div class="overflow-hidden">
				<div
					class="row no-wrap"
					:style="{
						width: (Object.keys(options$.qurlProxy.headersAll).length + 2) * 100 + '%',
						'max-height': (tableHeight - 49) + 'px',
					}"
				>
					<kv-table
						v-for="table, _key, index of options$.qurlProxy.headersAll" :key="table.name"
						class="full-width relative-position overflow-auto"
						:class="{invisible: options$.qurlProxy.tab !== table.name}"
						:style="{
							'max-width': 100 / (Object.keys(options$.qurlProxy.headersAll).length + 2) + '%',
							right: index * 100 / (Object.keys(options$.qurlProxy.headersAll).length + 2) + '%',
						}"
						:inert="options$.qurlProxy.tab !== table.name"
						:hide-columns="table.deleteMode ? 'value' : undefined"
						:table-height="tableHeight - 49"
						v-model:text-mode="table.textMode"
						v-model:text-value="table.textValue"
						v-model="table.rows"
						v-model:pagination="table.pagination"
					/>
					<req-body-form
						class="full-width relative-position overflow-auto"
						:class="{invisible: options$.qurlProxy.tab !== 'body'}"
						:style="{
							'max-width': 100 / (Object.keys(options$.qurlProxy.headersAll).length + 2) + '%',
							right: Object.keys(options$.qurlProxy.headersAll).length * 100
								/ (Object.keys(options$.qurlProxy.headersAll).length + 2) + '%',
						}"
						:inert="options$.qurlProxy.tab !== 'body'"
						:form-table-height="tableHeight - 98"
						v-model:type="options$.qurlProxy.body.type"
						v-model:form-text-mode="options$.qurlProxy.body.formTextMode"
						v-model:form-text-value="options$.qurlProxy.body.formTextValue"
						v-model:form-pagination="options$.qurlProxy.body.formPagination"
						v-model:file-accept="options$.qurlProxy.body.fileAccept"
						v-model:text-lang="options$.qurlProxy.body.textLang"
						v-model="options$.qurlProxy.body.value"
					/>
					<res-body-form
						class="full-width relative-position overflow-auto"
						:class="{invisible: options$.qurlProxy.tab !== 'resBody'}"
						:style="{
							'max-width': 100 / (Object.keys(options$.qurlProxy.headersAll).length + 2) + '%',
							right: (Object.keys(options$.qurlProxy.headersAll).length + 1) * 100
								/ (Object.keys(options$.qurlProxy.headersAll).length + 2) + '%',
						}"
						:inert="options$.qurlProxy.tab !== 'resBody'"
						v-model="options$.qurlProxy.resBody"
					/>
				</div>
			</div>
		</q-expansion-item>
	</q-list>
	<div class="absolute-full no-pointer-events">
		<q-resize-observer debounce="0" @resize="height$ = $event.height"/>
	</div>
</div>
</template>

<style scoped lang="scss">
.list-item-input {
	:deep(.q-field__control-container) {
		margin-inline: 26px 10px;
	}
}

.qurl-proxy-config {
	pointer-events: initial;

	&:focus-visible {
		outline: none;

		* {
			color: var(--q-primary);
		}
	}
}

.proxy-options {
	display: grid;
	grid-auto-flow: column;
	grid-auto-columns: minmax(0, 1fr);

	& > * {
		padding: 4px 6px;

		&:first-child {
			padding-left: 12px;
		}

		&:last-child {
			padding-right: 12px;
		}
	}

	.artisan-http-method-field {
		padding: 0;

		& > :deep(*) {
			padding: 4px 12px;
		}
	}
}
</style>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {
	AppService,
	HttpMethodField,
	MenuItem,
	ReqBodyForm,
	KvTable,
	ReqBodyType,
	ReqOptionsFormToggle,
	type ReqOptions,
	ResBodyForm,
	ResBodyType,
	SuggestedInput,
	useUiStore,
} from '@'

const
	{ripple$} = useUiStore(),

	height$ = ref(0),

	$props = defineProps<{
		disableExtract?: boolean | undefined,
		tableHeight: number,
	}>(),

	$emits = defineEmits<{
		extractQurlProxy: [],
	}>(),

	options$ = defineModel<ReqOptions>({required: true}),

	qurlProxyConfig$ = computed(() => {
		const {server} = options$.value.qurlProxy
		if (server.disable || !server.value)
			return undefined
		const url = AppService.resolveUrl(server.value)
		return AppService.isValidUrl(url) ? AppService.resolveUrl('/api/qurl-proxy-config', url) : undefined
	}),

	retriesPreview$ = computed(() => {
		const
			{retry, retryIn, retryFactor, retryLimit} = options$.value.qurlProxy,
			retries = +(retry || 0),
			interval = +(retryIn || 0),
			backoffMultiplier = +(retryFactor || 1),
			backoffLimit = +(retryLimit || Infinity)
		return !interval || !backoffMultiplier || !backoffLimit ? '' : Array<void>(Math.min(retries, 128)).fill()
			.map((_, attempt) => {
				const ms = Math.min(backoffMultiplier ** attempt * interval, backoffLimit)
				return ms < 60_000 ? (+(ms / 1_000)?.toFixed(3) + ' s') : (+(ms / 60_000)?.toFixed(2) + ' m')
			})
			.join(', ')
	}),

	PROXY_OPTIONS = AppService.freeze([
		[
			{name: 'retry', digits: 16, icon: 'mdi-reload', label: 'Retries', caption: 'Count after first request'},
			{name: 'retryIn', digits: 16, icon: 'mdi-timer-outline', label: 'Interval, ms', caption: 'Between retries'},
		],
		[
			{name: 'retryFactor', digits: 16, icon: 'mdi-chart-line-variant', label: 'Backoff Multiplier', caption: 'Per retry'},
			{name: 'retryLimit', digits: 16, icon: 'mdi-timer-lock-outline', label: 'Backoff Limit, ms', caption: 'Max. retry interval'},
		],
		'RETRIES_PREVIEW',
		[
			{name: 'timeout', digits: 16, icon: 'mdi-clock-remove-outline', label: 'Timeout, ms', caption: 'Abort request after'},
			{name: 'ttfb', digits: 16, icon: 'mdi-timer-sand', label: 'TTFB, ms', caption: 'Time to first byte'},
		],
		[
			{name: 'throttle', digits: 16, icon: 'mdi-speedometer-medium', label: 'Throttle Both, kbit/s', caption: 'Bidirectional bandwidth limit', options: throttleOptions(false)},
		],
		[
			{name: 'throttleUp', digits: 16, icon: 'mdi-speedometer-slow', label: 'Throttle Upload, kbit/s', caption: 'Upload bandwidth limit', options: throttleOptions(true)},
		],
		[
			{name: 'status', digits: 3, icon: 'mdi-numeric', label: 'Status', caption: 'Response status code'},
			{name: 'method', caption: 'Override', options: [{}]},
		],
	] as Array<string | {
		name: string,
		digits?: number,
		icon: string,
		label: string,
		caption: string,
		options?: {icon: string, label: string, value: string}[],
	}[]>)

function throttleOptions(upload: boolean) {
	return [
		{icon: 'mdi-signal-3g', label: '3G', value: !upload ? '384' : '256'},
		{icon: 'mdi-signal-hspa', label: 'H', value: !upload ? '7000' : '2000'},
		{icon: 'mdi-signal-hspa-plus', label: 'H+', value: !upload ? '12000' : '5000'},
		{icon: 'mdi-signal-4g', label: '4G', value: !upload ? '50000' : '15000'},
	]
}

function numericMask(digits: number) {
	let mask = '#'
	for (let c = 1; c < digits; c++)
		mask = (c % 3 ? '#' : '# ') + mask
	return mask
}
</script>
