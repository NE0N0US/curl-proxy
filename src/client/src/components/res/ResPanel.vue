<template>
<div
	v-if="req$.result && 'error' in req$.result"
	class="artisan-res-panel doc-section column no-wrap gap-sm"
>
	<div>
		Error getting response. This may be due to an invalid URL, credentials in the URL, browser restrictions, or a network error.
	</div>
	<div>
		Try using <a href="/" target="_blank" translate="no">cURL Proxy</a> to bypass browser restrictions, or check your network connection.
	</div>
	<div>
		Newer Chrome versions may <a href="https://developer.chrome.com/blog/local-network-access" target="_blank">block LAN requests</a>. Set <a href="chrome://flags/#local-network-access-check" target="_blank">chrome://flags/#local-network-access-check</a> to Disabled to fix this.
	</div>
</div>
<div v-else-if="!req$.result" class="artisan-res-panel doc-section">
	No response received yet. Send a request to see the response here.
</div>
<div v-else class="artisan-res-panel full-width grow column no-wrap overflow-hidden">
	<div class="row no-wrap gap-sm">
		<q-tabs
			align="left" narrow-indicator inline-label no-caps
			v-model="req$.resultTab"
		>
			<q-tab
				icon="mdi-text-box-outline"
				label="Body"
				name="body"
				:ripple="ripple$"
			/>
			<q-tab
				icon="mdi-table"
				label="Headers"
				name="headers"
				:ripple="ripple$"
			/>
		</q-tabs>
		<q-space/>
		<div class="row no-wrap items-center gap-sm overflow-auto">
			<template v-if="req$.result.res">
				<q-chip
					v-if="stats$"
					class="cursor-pointer"
					:ripple="ripple$"
					@click.passive="statsTooltip$ = !statsTooltip$"
				>
					<q-icon name="mdi-chart-bar"/>
					<q-tooltip
						:ref="tooltip => statsTooltipElement$ = <HTMLElement>(<QTooltip>tooltip)?.contentEl"
						no-parent-event
						:delay="300"
						:model-value="statsTooltip$"
						:offset="[0, 10]"
						transition-show="none" transition-hide="none"
					>
						<div class="stats-tooltip">
							<span>Failed</span>
							<span translate="no">{{stats$.failed}}</span>
							<span>OK (2xx)</span>
							<span translate="no">{{stats$.ok}}</span>
							<span>TTFB</span>
							<span translate="no">{{stats$.ttfb}}</span>
							<span>Download (OK)</span>
							<span translate="no">{{stats$.download}}</span>
						</div>
					</q-tooltip>
				</q-chip>
				<q-chip :label="req$.result.res.status" :ripple="false">
					<q-tooltip
						v-if="req$.result.res.statusText"
						translate="no"
						:delay="300" :offset="[0, 10]" transition-duration="0"
					>
						{{req$.result.res.statusText}}
					</q-tooltip>
				</q-chip>
				<q-chip
					v-if="req$.result.resMs !== undefined"
					:label="formatResTime(req$.result.resMs! + (req$.result.blobMs ?? (now$ - req$.result.resTime!)))"
					:ripple="false"
				>
					<q-tooltip :delay="300" :offset="[0, 10]" transition-duration="0">
						{{
							formatResTime(req$.result.resMs!)
						}} (<span translate="no">TTFB</span>) + {{
							formatResTime(req$.result.blobMs ?? (now$ - req$.result.resTime!))
						}}
					</q-tooltip>
				</q-chip>
				<q-chip
					v-if="req$.result.blob?.size || req$.result.blobSize"
					:label="AppService.formatDataSize(req$.result.blob?.size || req$.result.blobSize!)"
					:ripple="false"
				>
					<q-tooltip
						v-if="(req$.result.blob?.size || req$.result.blobSize!) >= 1024"
						:delay="300" :offset="[0, 10]" transition-duration="0"
					>
						{{AppService.formatNumber(req$.result.blob?.size || req$.result.blobSize!)}}&nbsp;B
					</q-tooltip>
				</q-chip>
				<q-chip
					v-if="(req$.result.blob?.size || req$.result.blobSize) && bodyType$"
					translate="no"
					:label="bodyType$"
					:ripple="false"
				/>
			</template>
			<q-chip v-else-if="req$.fetching" :ripple="false">
				<q-spinner-dots size="21px"/>
			</q-chip>
		</div>
		<div/>
	</div>
	<q-separator/>
	<div class="grow overflow-auto">
		<q-tab-panels class="fit bg-background text-text" v-model="req$.resultTab">
			<q-tab-panel class="q-pa-none overflow-hidden" name="body">
				<div v-if="req$.result?.blob?.size" class="fit column no-wrap">
					<q-tabs
						align="left" narrow-indicator inline-label no-caps
						v-model="req$.resultBodyTab"
					>
						<q-tab
							v-for="{label, name} of BODY_OPTIONS" :key="name"
							:label="label" :name="name"
							:ripple="ripple$"
						/>
					</q-tabs>
					<q-separator/>
					<div v-if="req$.resultBodyTab === 'preview'" class="grow overflow-hidden">
						<object
							class="fit overflow-auto"
							:key="req$.result.blob.type"
							:data="blobUrl$"
							:type="req$.result.blob.type"
							:width="previewSize$.width" :height="previewSize$.height"
						/>
						<q-resize-observer @resize="previewSize$ = $event"/>
					</div>
					<code-editor v-else
						class="overflow-auto"
						no-lang-options
						disable
						placeholder="Loading…"
						:no-line-wrap="req$.resultBodyTab === 'hex'"
						:lang="<any>req$.resultBodyTab"
						:model-value="req$.resultBodyTab === 'hex' ? hex$ : text$"
					/>
				</div>
				<div v-else-if="req$.result.blob" class="doc-section">
					No response body.
				</div>
				<div v-else class="doc-section">
					Loading…
				</div>
			</q-tab-panel>
			<q-tab-panel class="q-pa-none overflow-hidden" name="headers">
				<kv-table
					class="fit overflow-auto"
					readonly
					hide-columns="disable"
					v-model:text-mode="req$.resultHeadersTextMode"
					:text-value="''"
					v-model="headers$"
					v-model:pagination="req$.resultHeadersPagination"
				/>
			</q-tab-panel>
		</q-tab-panels>
	</div>
</div>
</template>

<style scoped lang="scss">
.q-chip {
	margin: 0;
	min-width: min-content;
	border: 1px solid var(--color-border);
	background-color: var(--color-background);
	color: var(--color-text);
	user-select: none;
}

.stats-tooltip {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 8px 12px;
}

object {
	object-fit: scale-down;
}
</style>

<script setup lang="ts">
import {computed, onUnmounted, ref, shallowRef, watch} from 'vue'
import {type QTooltip} from 'quasar'
import {computedAsync, onClickOutside, useTimestamp} from '@vueuse/core'
import {
	AppService,
	CodeEditor,
	CodeService,
	KvTable,
	useConcurrentWorkerFn,
	useReqStore,
	useUiStore,
} from '@'

const
	now$ = useTimestamp(),
	{req$} = useReqStore(),
	{ripple$} = useUiStore(),

	previewSize$ = ref({width: 0, height: 0}),

	statsTooltipElement$ = shallowRef<HTMLElement>(),
	listenerOutsideStatsTooltip = onClickOutside(statsTooltipElement$,
		() => setTimeout(() => statsTooltip$.value = false)
	),

	statsTooltip$ = ref(false),

	stats$ = computed(() => {
		const fetchStats = req$.value.fetchStats
		if (!fetchStats?.length)
			return null
		const
			stats = fetchStats.filter(stat => stat !== false),
			ttfb = stats.map(({resMs}) => resMs),
			ok = stats.filter(({ok}) => ok),
			download = ok.map(({blobMs}) => blobMs)
		return {
			failed: `${
				AppService.formatNumber((fetchStats.length - stats.length) / fetchStats.length * 100, 1)
			}% (${
				AppService.formatNumber(fetchStats.length - stats.length)
			} / ${
				AppService.formatNumber(fetchStats.length)
			})`,
			ok: `${
				AppService.formatNumber(ok.length / fetchStats.length * 100, 1)
			}% (${
				AppService.formatNumber(ok.length)
			} / ${
				AppService.formatNumber(fetchStats.length)
			})`,
			ttfb: `~${
				AppService.formatNumber(ttfb.reduce((sum, value) => sum + value, 0) / ttfb.length)
			} (${
				AppService.formatNumber(Math.min(...ttfb))
			}–${
				AppService.formatNumber(Math.max(...ttfb))
			})`,
			download: `~${
				AppService.formatNumber(download.reduce((sum, value) => sum + value, 0) / download.length)
			} (${
				AppService.formatNumber(Math.min(...download))
			}–${
				AppService.formatNumber(Math.max(...download))
			})`,
		}
	}),

	bodyType$ = computed(() =>
		req$.value.result?.res?.headers?.get('Content-Type')?.split(';')[0]
	),

	BODY_OPTIONS = AppService.freeze([
		{label: 'Preview', name: 'preview'},
		{label: 'HEX', name: 'hex'},
		{label: 'Plain Text', name: 'plaintext'},
		{label: 'JSON', name: 'json'},
		{label: 'XML', name: 'xml'},
		{label: 'HTML', name: 'html'},
		{label: 'JavaScript', name: 'javascript'},
	]),

	blobUrl$ = computed(() => {
		const blob = req$.value.result?.blob
		return blob ? URL.createObjectURL(blob) : undefined
	}),

	watcherBlobUrl = watch(blobUrl$, (_, oldValue) => {
		if (oldValue)
			URL.revokeObjectURL(oldValue)
	}),

	textCache = new WeakMap<Blob, Record<string, string>>(),

	hex$ = computedAsync(
		() => {
			const
				req = req$.value,
				blob = req.result?.blob
			return (req.resultBodyTab === 'hex' && blob?.size) ? resTextCached(
				'hex',
				() => resHex(blob).catch(error => {
					console.error(error)
					return 'Error displaying HEX' +
						(error instanceof RangeError ? ' – string exceeds browser limits' : '')
				})
			) : ''
		},
		''
	),

	textRaw$ = computedAsync(
		() => resTextCached(
			'plaintext',
			() => {
				const blob = req$.value.result!.blob!
				return blob.text()
					.then(text => (blob.size && !text.length)
						? 'Error displaying text – string exceeds browser limits'
						: text
					)
					.catch(error => {
						console.error(error)
						return 'Error displaying text' +
							(error instanceof RangeError ? ' – string exceeds browser limits' : '')
					})
			}
		),
		''
	),

	text$ = computedAsync(
		() => {
			const
				req = req$.value,
				textRaw = textRaw$.value
			return (req.resultBodyTab !== 'hex' && textRaw) ? resTextCached(
				req.resultBodyTab,
				() => CodeService.prettify(textRaw, req.resultBodyTab).catch(() => textRaw)
			) : ''
		},
		''
	),

	headers$ = computed(() =>
		[...req$.value.result?.res?.headers.entries() ?? []]
			.map(([key, value]) => ({disable: false, key, value}))
	)

onUnmounted(() => {
	const resBlobUrl = blobUrl$.value
	if (resBlobUrl)
		URL.revokeObjectURL(resBlobUrl)
})

function formatResTime(ms: number) {
	return ms < 1_000 ? (Math.ceil(ms) + '\xA0ms')
		: (+(Math.ceil(ms) / 1_000)?.toFixed(3) + '\xA0s')
}

const resHex = useConcurrentWorkerFn(async (blob: Blob, bytesPerLine = 16) => {
	const
		bytes = new Uint8Array(await blob.arrayBuffer()),
		lines = []
	for (let c = 0; c < bytes.length; c += bytesPerLine) {
		const
			address = c.toString(16).padStart(8, '0').toUpperCase(),
			chunk = bytes.subarray(c, c + bytesPerLine),
			hex = Array.from(chunk, b => b.toString(16).padStart(2, '0').toUpperCase())
				.join(' ')
				.padEnd(bytesPerLine * 3 - 1, ' '),
			ascii = Array.from(chunk, b =>
				b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'
			).join('')
		lines.push([address, hex, ascii].join('  '))
	}
	return lines.join('\n')
})

async function resTextCached(cacheKey: string, compute: () => Promise<string>) {
	const req = req$.value
	if (!req.result?.blob || req.resultBodyTab === 'preview')
		return ''
	const cache = textCache.get(req.result.blob) ?? {}
	textCache.set(req.result.blob, cache)
	return cache[cacheKey] ??= await compute()
}
</script>
