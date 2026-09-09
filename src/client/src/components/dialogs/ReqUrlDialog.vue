<template>
<q-dialog
	class="artisan-req-url-dialog"
	ref="dialogRef"
	maximized
	transition-duration="0"
	@hide="req$.url = req$.url.replaceAll('\n', ''); onDialogHide()"
>
	<div class="max-width-sm max-width-separators fit column no-wrap bg-background">
		<div class="sticky-header">
			<q-toolbar class="non-selectable">
				<q-btn
					v-if="$q.screen.width < $q.screen.sizes.md"
					icon="mdi-arrow-left" flat round :ripple="ripple$"
					@click.passive="onDialogOK()"
				/>
				<q-toolbar-title>Request URL</q-toolbar-title>
				<q-btn
					v-if="$q.screen.width >= $q.screen.sizes.md"
					icon="mdi-close" flat round :ripple="ripple$"
					@click.passive="onDialogOK()"
				/>
			</q-toolbar>
			<q-separator/>
		</div>
		<req-url-field class="grow" expanded v-model="req$.url"/>
	</div>
</q-dialog>
</template>

<style scoped lang="scss">
.q-dialog {
	.artisan-req-url-field :deep(.q-textarea) {
		padding: 4px 12px;
	}
}
</style>

<script setup lang="ts">
import {useDialogPluginComponent} from 'quasar'
import {ReqUrlField, useReqStore, useUiStore} from '@'

const
	{req$} = useReqStore(),
	{ripple$} = useUiStore(),

	{dialogRef, onDialogHide, onDialogOK} = useDialogPluginComponent(),

	$emit = defineEmits([
		...useDialogPluginComponent.emits,
	])
</script>
