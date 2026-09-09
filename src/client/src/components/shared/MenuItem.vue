<template>
<q-item
	class="artisan-menu-item"
	:tag="useLabel ? 'label' : 'div'"
	:disable="disable"
	:active="active"
	clickable
	v-ripple="disable ? false : ripple$"
	@click.passive="disable ? $event.stopPropagation() : $emit('click')"
>
	<q-item-section v-if="icon || $slots.avatar" avatar>
		<q-icon v-if="!$slots.avatar" :name="icon"/>
		<slot v-else name="avatar"/>
	</q-item-section>
	<q-item-section>
		<q-item-label lines="1">
			{{label}}
		</q-item-label>
		<q-item-label v-if="caption" lines="1" caption>
			{{caption}}
		</q-item-label>
	</q-item-section>
	<q-item-section v-if="$slots.default" side>
		<slot/>
	</q-item-section>
</q-item>
</template>

<script setup lang="ts">
import {useUiStore} from '@'

const
	{ripple$} = useUiStore(),

	$props = defineProps<{
		icon?: string | undefined,
		label: string,
		caption?: string | undefined,
		disable?: boolean | undefined,
		active?: boolean | undefined,
		useLabel?: boolean | undefined,
	}>(),

	$emit = defineEmits<{
		click: [],
	}>()
</script>
