<template>
<div class="artisan-splitter-accordion column no-wrap overflow-hidden">
	<div>
		<slot name="header-start"/>
		<q-separator/>
		<q-resize-observer debounce="0" @resize="heightStart$ = $event.height"/>
	</div>
	<q-splitter
		class="full-width grow overscroll-contain-y overflow-hidden"
		:class="{'q-splitter--active': autosizing$}"
		horizontal
		:limits="limits$"
		v-model="splitter$"
		unit="px"
		:disable="!!collapse$"
		:separator-class="{'no-height': collapse$ === 'start'}"
		before-class="overflow-hidden" after-class="overflow-hidden"
	>
		<template #before>
			<div class="fit column no-wrap">
				<div class="full-width grow column no-wrap overflow-hidden">
					<div class="grow overflow-auto column no-wrap" :inert="collapse$ === 'start'">
						<slot name="content-start"/>
					</div>
				</div>
			</div>
		</template>
		<template #after>
			<div class="fit column no-wrap">
				<div class="full-width grow column no-wrap overflow-hidden">
					<div>
						<slot name="header-end"/>
						<q-resize-observer debounce="0" @resize="heightEnd$ = $event.height"/>
					</div>
					<q-separator/>
					<div class="grow overflow-auto column no-wrap" :inert="collapse$ === 'end'">
						<slot name="content-end"/>
					</div>
				</div>
			</div>
		</template>
		<template #separator>
			<q-avatar
				class="separator-icon" :class="{'no-height': !!collapse$}"
				icon="mdi-drag-horizontal-variant"
				color="background"
			/>
		</template>
	</q-splitter>
	<q-resize-observer debounce="0" @resize="height$ = $event.height"/>
</div>
</template>

<style scoped lang="scss">
.overscroll-contain-y {
	overscroll-behavior-y: contain;
}

.q-splitter:not(.q-splitter--active) {
	--height-transition-duration: 300ms;

	@media print, (prefers-reduced-motion: reduce) {
		--height-transition-duration: 1ms;
	}
}

.q-splitter :deep(> .q-splitter__before) {
	// https://easings.net/#easeInOutSine
	transition: height var(--height-transition-duration) cubic-bezier(0.37, 0, 0.63, 1);
}

.q-splitter :deep(> .q-splitter__separator.no-height) {
	transition: height 0;
	transition-delay: var(--height-transition-duration);
}

.separator-icon {
	width: 32px;
	height: 32px;
	color: var(--color-border);
}
</style>

<script setup lang="ts">
import {computed, ref, watch} from 'vue'

let timeoutLimits: number

const
	collapse$ = defineModel<null | 'start' | 'end'>({required: true}),

	splitterLast$ = ref(0),
	splitter$ = computed({
		get: () => !collapse$.value ? splitterLast$.value : collapse$.value === 'start' ? 0
			: (height$.value - heightEnd$.value - 1 - heightStart$.value),
		set: value => {
			if (!collapse$.value)
				splitterLast$.value = value
		},
	}),

	heightStart$ = ref(0),
	heightEnd$ = ref(0),
	height$ = ref(0),

	autosizing$ = ref(false),

	limits$ = computed(() => [
		heightStart$.value,
		Math.max(0, height$.value - 2 * heightEnd$.value - heightStart$.value - 2),
	].sort((a, b) => a - b)),

	watcherLimits = watch(limits$, () => {
		autosizing$.value = true
		clearTimeout(timeoutLimits)
		// NOTE: basic workaround
		timeoutLimits = setTimeout(() => autosizing$.value = false, 300) as any
	}),

	watcherViewInit = watch([height$, heightEnd$, heightStart$], ([height, end, start]) =>
		splitterLast$.value = Math.floor((height - end - 1 - start) / 2),
	{once: true})
</script>
