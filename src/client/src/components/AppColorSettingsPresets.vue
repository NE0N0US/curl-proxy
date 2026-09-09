<template>
<q-list class="app-color-settings-presets non-selectable">
	<menu-item
		v-for="{icon, label, caption, colors} of scheme === 'light' ? PRESETS_LIGHT : PRESETS_DARK" :key="label"
		:icon="icon" :label="label" :caption="caption"
		@click="preset$ = colors"
	>
		<q-icon v-if="deepEqual(colors, preset$)" name="mdi-check" color="text"/>
	</menu-item>
</q-list>
</template>

<script setup lang="ts">
import {is} from 'quasar'
const {deepEqual} = is
import {AppService, MenuItem} from '@'

const
	$props = defineProps<{
		scheme: string,
	}>(),

	preset$ = defineModel<string[]>({required: true}),
	PRESETS_LIGHT = AppService.freeze([
		// https://github.com/76784/Daobeam#comparison-of-biege-background-usages
		{icon: 'mdi-weather-sunny', label: 'Light', caption: 'Warm low-contrast', colors: [
			'#e0dbc7', '#171717', '#575aff',
			'#c100c2', '#d90062', '#b65a00',
		]},
		{icon: 'mdi-weather-sunny', label: 'Light Gray', caption: 'Neutral low-contrast', colors: [
			'#dbdbdb', '#171717', '#d90062',
			'#c100c2', '#d90062', '#b65a00',
		]},
		{icon: 'mdi-brightness-7', label: 'White', caption: 'Bright high-contrast', colors: [
			'#ffffff', '#000000', '#00aaff',
			'#c100c2', '#d90062', '#b65a00',
		]},
	]),

	PRESETS_DARK = AppService.freeze([
		{icon: 'mdi-weather-night', label: 'Dark', caption: 'Blue-gray low-contrast', colors: [
			'#1a1d2b', '#dcdcdc', '#bc9d00',
			'#ff6cfe', '#ff618e', '#ff974f',
		]},
		{icon: 'mdi-circle-half-full', label: 'Dark Gray', caption: 'Neutral low-contrast', colors: [
			'#1e1e1e', '#dcdcdc', '#ff618e',
			'#ff6cfe', '#ff618e', '#ff974f',
		]},
		{icon: 'mdi-brightness-4', label: 'Black', caption: 'AMOLED high-contrast', colors: [
			'#000000', '#ffffff', '#fe7000',
			'#ff6cfe', '#ff618e', '#ff974f',
		]},
	])
</script>
