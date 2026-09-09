<template>
<div class="artisan-res-toolbar-actions row no-wrap gap-sm">
	<q-btn
		icon="mdi-download"
		:disable="!req$.result?.blob?.size"
		flat round :ripple="ripple$"
		@click.passive="download()"
	>
		<q-tooltip
			v-if="req$.result?.blob?.size"
			:delay="300" transition-duration="0"
		>
			Download
		</q-tooltip>
	</q-btn>
	<q-btn
		icon="mdi-trash-can-outline"
		:disable="!req$.result"
		flat round :ripple="ripple$"
		@click.passive="clear()"
	>
		<q-tooltip
			v-if="req$.result"
			:delay="300" transition-duration="0"
		>
			Clear
		</q-tooltip>
	</q-btn>
	<q-icon
		class="q-pa-sm"
		:name="online$ ? 'mdi-lan-connect' : 'mdi-lan-disconnect'"
		size="24px"
	>
		<q-tooltip :delay="300" transition-duration="0">
			You are currently {{online$ ? 'online' : 'offline'}}
		</q-tooltip>
	</q-icon>
</div>
</template>

<script setup lang="ts">
import {date, exportFile} from 'quasar'
const {formatDate} = date
import {useOnline, useReqStore, useUiStore} from '@'

const
	online$ = useOnline(),
	{req$} = useReqStore(),
	{notify, ripple$} = useUiStore()

function download() {
	const blob = req$.value.result?.blob
	if (blob?.size) {
		const exported = exportFile(
			`artisan-response-${formatDate(Date.now(), 'YYYY-MM-DDTHH-mm-ss')}`,
			blob,
			{mimeType: blob.type}
		)
		if (exported !== true) {
			console.error(exported)
			notify('Error downloading response')
		}
		else
			notify({
				message: 'Downloading response',
				icon: 'mdi-download',
			})
	}
}

function clear() {
	const req = req$.value
	req.fetching = false
	req.fetchStats = null
	req.result = null
}
</script>
