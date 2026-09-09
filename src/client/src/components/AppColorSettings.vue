<template>
<div class="artisan-app-color-settings column no-wrap">
	<q-tabs
		breakpoint="0"
		outside-arrows mobile-arrows
		narrow-indicator inline-label no-caps
		v-model="colorScheme$"
	>
		<q-tab
			icon="mdi-weather-sunny"
			label="Light"
			name="light"
			:ripple="ripple$"
		/>
		<q-tab
			icon="mdi-weather-night"
			label="Dark"
			name="dark"
			:ripple="ripple$"
		/>
		<q-tab
			icon="mdi-theme-light-dark"
			label="Auto"
			name="auto"
			:ripple="ripple$"
		/>
	</q-tabs>
	<q-separator/>
	<template v-if="colorScheme$ === 'light' || colorScheme$ === 'dark'">
		<app-color-settings-presets :scheme="colorScheme$" v-model="preset$"/>
		<q-separator/>
		<template v-for="{icon, color, model, separatorAfter} of colors$" :key="color">
			<q-input
				spellcheck="false" autocomplete="off"
				:label="color + ' Color'"
				:shadow-text="model.value ? ' ' : 'CSS <color> value'"
				v-model="model.value" debounce="300"
				borderless hide-bottom-space dense
				input-class="artisan-mono"
			>
				<template #prepend>
					<q-icon :name="icon" color="text"/>
				</template>
				<template #after>
					<q-btn
						icon="mdi-eyedropper"
						flat round color="text" :ripple="ripple$"
					>
						<q-menu
							separate-close-popup
							max-width="calc(100dvw - 40px)" max-height="calc(100dvh - 24px)"
							transition-show="none" transition-hide="none"
						>
							<div
								class="column no-wrap non-selectable"
								:style="{'--model': model.value}"
							>
								<div class="sticky-header">
									<div class="color-picker-header">
										<q-input
											:style="headerColors(model.value!)"
											spellcheck="false" autocomplete="off"
											:label="color + ' Color'"
											:shadow-text="model.value ? ' ' : 'CSS <color> value'"
											v-model="model.value"
											borderless hide-bottom-space square dense
											input-class="artisan-mono"
										>
												<q-btn
													v-close-popup
													icon="mdi-check"
													flat round color="text" :ripple="ripple$"
												/>
										</q-input>
									</div>
									<q-separator/>
								</div>
								<q-color
									class="bg-background"
									translate="no"
									default-view="tune" no-header no-footer
									v-model="model.value"
									square flat
								/>
								<div class="overflow-hidden q-pa-md">
									<q-color
										class="bg-background"
										no-header no-footer
										v-model="model.value"
										square flat
									/>
								</div>
								<q-separator/>
								<q-color
									class="bg-background"
									default-view="palette"
									:palette="PALETTE"
									no-header no-footer
									v-model="model.value"
									square flat
								/>
							</div>
						</q-menu>
					</q-btn>
				</template>
			</q-input>
			<q-separator v-if="separatorAfter"/>
		</template>
	</template>
	<div v-else class="auto-theme-hint">
		Select a light or dark theme to preview and edit it. Auto switches between them automatically.
	</div>
</div>
</template>

<style scoped lang="scss">
.artisan-app-color-settings {
	width: min-content;
	max-width: 100%;
}

.q-btn-group, .q-btn-dropdown, .auto-theme-hint {
	min-height: 48px;
	border-radius: 0;
}

.q-input {
	padding: 4px 8px 4px 16px;
}

.auto-theme-hint {
	padding: 8px 16px;
}

.sticky-header {
	z-index: 2;
}

.color-picker-header {
	background: white url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2U4ZThlOCIvPjxyZWN0IHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlOGU4ZTgiLz48L3N2Zz4=');

	& > :deep(*) {
		background-color: var(--model);
		caret-color: var(--color-text);

		.q-field__label, &.q-field--focused .q-field__shadow {
			opacity: 1 !important;
		}
	}
}

.q-color-picker {
	:deep(.q-slider__inner) {
		background-color: var(--color-border);
	}

	:deep(.q-color-picker__tune-tab) {
		padding: 8px 16px 0 16px;

		input {
			border-color: var(--color-border);
		}
	}

	&, :deep(.q-tab-panels), :deep(.q-panel), :deep(.q-tab-panel) {
		overflow: initial !important;
	}

	:deep(.q-color-picker__spectrum-tab) {
		.q-color-picker__spectrum-circle {
			width: 16px;
			height: 16px;
			position: relative;
			top: -3px;
			left: -3px;
			box-shadow: none;
			background-color: var(--model);
			border: 1px solid white;
			outline: 1px solid black;
		}

		.q-color-picker__sliders, .q-slider__track-container {
			margin-top: 8px;
			padding: 0;
			line-height: 0;
		}

		.q-slider__track {
			border-radius: 0;
			height: 8px !important;
		}

		.q-slider__thumb {
			width: 10px !important;
			height: 18px !important;
			background-color: white;
			border-radius: 5px;
			border: 1px solid black;

			* {
				display: none;
			}
		}
	}
}
</style>

<script setup lang="ts">
import {computed} from 'vue'
import {colors} from 'quasar'
const {luminosity} = colors
import {AppColorSettingsPresets, useCssVarStore, CssVarStoreKey, useUiStore} from '@'

const
	{ripple$, colorScheme$} = useUiStore(),

	cssVarStore = useCssVarStore(),

	colorsLight = [
		{
			icon: 'mdi-format-color-fill',
			color: 'Background',
			model: cssVarStore.get(CssVarStoreKey.LIGHT_BACKGROUND),
		},
		{
			icon: 'mdi-format-color-text',
			color: 'Text',
			model: cssVarStore.get(CssVarStoreKey.LIGHT_TEXT),
		},
		{
			icon: 'mdi-format-color-highlight',
			color: 'Accent',
			model: cssVarStore.get(CssVarStoreKey.LIGHT_ACCENT),
			separatorAfter: true,
		},
		{
			icon: 'mdi-function',
			color: 'Code Syntax',
			model: cssVarStore.get(CssVarStoreKey.LIGHT_CODE_SYNTAX),
		},
		{
			icon: 'mdi-variable',
			color: 'Code Entity',
			model: cssVarStore.get(CssVarStoreKey.LIGHT_CODE_ENTITY),
		},
		{
			icon: 'mdi-numeric',
			color: 'Code Value',
			model: cssVarStore.get(CssVarStoreKey.LIGHT_CODE_VALUE),
		},
	],

	colorsDark = [
		{
			icon: 'mdi-format-color-fill',
			color: 'Background',
			model: cssVarStore.get(CssVarStoreKey.DARK_BACKGROUND),
		},
		{
			icon: 'mdi-format-color-text',
			color: 'Text',
			model: cssVarStore.get(CssVarStoreKey.DARK_TEXT),
		},
		{
			icon: 'mdi-format-color-highlight',
			color: 'Accent',
			model: cssVarStore.get(CssVarStoreKey.DARK_ACCENT),
			separatorAfter: true,
		},
		{
			icon: 'mdi-function',
			color: 'Code Syntax',
			model: cssVarStore.get(CssVarStoreKey.DARK_CODE_SYNTAX),
		},
		{
			icon: 'mdi-variable',
			color: 'Code Entity',
			model: cssVarStore.get(CssVarStoreKey.DARK_CODE_ENTITY),
		},
		{
			icon: 'mdi-numeric',
			color: 'Code Value',
			model: cssVarStore.get(CssVarStoreKey.DARK_CODE_VALUE),
		},
	],

	colors$ = computed(() => colorScheme$.value === 'light' ? colorsLight : colorsDark),

	/** [OKLCH](https://harmonizer.evilmartians.com/#fZJBb4MgGIb_y7erWQAVlWO7ZJcuW9ZelmUHapGaUjCoXZam_32xWdcPD3j8HnngfeEMJ-X71lkQNAGjTsr0ID7PYOVRgQBKCCRQOzt42Q8gyjKBeu_dUYIgjyRLi5ygL7vRpexA2NGYS_LvYnMXC1x5UVJ2t7GYKp2pCh6oijQ4WFSVzVUkUFWEo0MRGlPlMxXPsIqSKmgr2hWfqbI8ULEwYBpTFTNVTgMVzYOAUVU5V_FQFSaMBqzmXbGwq4yX8YBfCexHFTzWd7WDBKTVRoFgFdrt1Uur1R3mJYIfyhj3fYclR3DVHtE6SjPEnr1SFsGMIbhR0iBWpIgtfyRaxwhmCzOiDRnHG76NvjOIpizHtLUHxDiZOurVMLRW9yDO_22_uJ0yIEB2tYQEdq1X9dA6O81BQKM3bqHhVvnfVJ2uWbd66Yzzq1bvBxDw0DTNffok_WEakuvlbvX1r_Ug_fRWpts2zq87WU--3ustXC6_) & [OKHSL(V)](https://ok-color-picker.netlify.app/) */
	PALETTE = Object.freeze([
		'#FED8D1','#F8DBC5','#EEDFC0','#DFE4C3','#CFE7CC','#C2E9DC','#BEE8EB','#D2E1FE','#F2D9F2','#FCD7E1','#FDCBC3','#F7D0B4','#E8D5AC','#D5DBAF','#C0DFBC','#AEE2D1','#A8E1E6','#C4D8FE','#EDCDEE','#FBCAD7','#FCBEB4','#F4C39F','#E3CB96','#CAD29A','#B0D7AB','#97DAC5','#8FD9DF','#B5CEFE','#E9C0EA','#FABDCE','#FBB0A4','#F2B68A','#DDBF7D','#C0C883','#9ECF98','#7ED2B9','#72D1D9','#A5C3FE','#E4B2E7','#F8AEC3','#FAA193','#EFA972','#D8B462','#B5BF6A','#8CC785','#5ECAAD','#4BC9D3','#95B8FF','#E0A4E3','#F79EB9','#F39081','#E8995A','#CEA644','#A9B250','#79BB72','#39BF9E','#01BCC9','#84AAFA','#D794DB','#EF8DAC','#E28679','#D88F55','#C09B41','#9EA64C','#71AE6B','#38B294','#0EAFBB','#7C9FE9','#C98ACC','#DF84A1','#D57E71','#CB864F','#B5913D','#949C46','#69A463','#33A78B','#08A5AF','#7495DB','#BD81C0','#D27C98','#C47368','#BB7B48','#A78536','#888F3F','#60965B','#2C997F','#0397A1','#6A89CA','#AE77B0','#C1728B',
		'#FFFFFF','#E0E0E0','#C1C1C1','#A3A3A3','#868686','#686868','#4D4D4D','#333333','#191919','#000000',
	]),

	preset$ = computed({
		get: () => colors$.value.map(({model}) => model.value!),
		set: value => {
			const colors = colors$.value
			value.forEach((color, index) => colors[index]!.model.value = color)
		}
	})

function headerColors(value: string) {
	let result = 'white'
	const
		div = Object.assign(
			document.body.appendChild(document.createElement('div')),
			{style: `display: none !important; color: ${value} !important`}
		),
		color = div.style.color ? getComputedStyle(div).color : 'rgb(255,255,255)',
		[r = 0, g = 0, b = 0, a = 1] = color.match(/[\d.]+/g)?.map(parseFloat) ?? [0, 0, 0],
		BG = 232
	document.body.removeChild(div)
	if (luminosity(`rgb(${
		Math.round(r! * a + BG * (1 - a))
	}, ${
		Math.round(g! * a + BG * (1 - a))
	}, ${
		Math.round(b! * a + BG * (1 - a))
	})`) > 0.5)
		result = 'black'
	return {
		'--color-background': result === 'white' ? 'black' : 'white',
		'--color-text': result,
		'--q-primary': result,
	}
}
</script>
