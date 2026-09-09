<template>
<q-dialog
	class="artisan-cookies-dialog"
	ref="dialogRef"
	full-height
	transition-duration="0"
	@hide="onDialogHide()"
>
	<div class="bordered-dialog column no-wrap bg-background">
		<div class="sticky-header">
			<q-toolbar class="non-selectable">
				<q-icon name="mdi-cookie-outline" size="24px"/>
				<q-toolbar-title>Cookies</q-toolbar-title>
				<q-btn
					icon="mdi-close" flat round :ripple="ripple$"
					@click.passive="onDialogOK()"
				/>
			</q-toolbar>
			<q-separator/>
		</div>
		<kv-table
			class="fit"
			hide-add
			hide-columns="disable"
			v-model:text-mode="textMode$"
			v-model:text-value="textValue$"
			v-model="cookies$" @update:model-value="updateCookies(<any>$event)"
			v-model:pagination="pagination$"
		/>
		<q-separator/>
		<div class="doc-section">
			<div class="q-py-xs row no-wrap items-center gap-sm">
				<q-icon name="mdi-alert-outline" size="24px"/>
				<span>Some cookies cannot be read or changed.</span>
			</div>
		</div>
	</div>
</q-dialog>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {useDialogPluginComponent} from 'quasar'
import {KvTable, type ReqKV, useUiStore} from '@'

const
	{ripple$} = useUiStore(),

	{dialogRef, onDialogHide, onDialogOK} = useDialogPluginComponent(),

	$emit = defineEmits([
		...useDialogPluginComponent.emits,
	]),

	textMode$ = ref(false),
	textValue$ = ref(''),
	pagination$ = ref({page: 1, rowsPerPage: 1}),

	cookies$ = ref(getCookies())

function getCookies(): ReqKV[] {
	return !document.cookie ? [] : document.cookie.split(';').map(cookie => {
		const
			index = cookie.indexOf('='),
			key = cookie.slice(0, index < 0 ? cookie.length : index).trim()
		let value = index < 0 ? '' : cookie.slice(index + 1).trim()
		try {
			value = decodeURIComponent(value)
		}
		catch {}
		return index ? {disable: false, key, value} : null
	}).filter(cookie => cookie !== null)
}

function setCookie(key: string, value: string, maxAge = 400 * 24 * 60 * 60) {
	if (key)
		document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=${maxAge}`
}

function updateCookies(cookies: ReqKV[]) {
	const
		cookiesMap = new Map(cookies.map(({key, value}) => [key, value])),
		oldCookies = getCookies()
	cookiesMap.forEach((value, key) => setCookie(key, value))
	oldCookies.forEach(({key}) => {
		if (!cookiesMap.has(key))
			setCookie(key, '', 0)
	})
	cookies$.value = getCookies()
}
</script>
