<template>
	<menu-item
		class="artisan-req-options-form-toggle q-pa-toolbar"
		:icon="icon"
		:label="label"
		:caption="caption"
		:disable="disable"
		use-label
	>
		<q-checkbox
			inert
			v-model="checked$"
			:disable="disable"
			color="text"
		/>
	</menu-item>
</template>

<script setup lang="ts">
import {MenuItem} from '@'

const
	$props = defineProps<{
		icon: string,
		label: string,
		caption: string,
		disable?: boolean | undefined,
	}>(),

	checked$ = defineModel<boolean>({required: true})
</script>
