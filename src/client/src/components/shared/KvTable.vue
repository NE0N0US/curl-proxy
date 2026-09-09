<template>
<q-input
	v-if="textMode$"
	class="artisan-kv-table q-px-md q-py-xs shadow-text-always shadow-text-3"
	spellcheck="false" autocomplete="off"
	:shadow-text="text$ ? ' ' : 'Cells separated by newlines\nRows separated by blank lines\nRows commented out with //'"
	autogrow
	v-model="text$"
	:readonly="readonly"
	borderless hide-bottom-space dense
	input-class="artisan-mono"
	@keydown.shift.enter.passive="saveText(readonly)"
>
	<template #after>
		<q-btn
			:icon="readonly ? 'mdi-arrow-left' : 'mdi-content-save-outline'"
			flat round color="text" :ripple="ripple$"
			@click.passive="saveText(readonly)"
		>
			<q-tooltip v-if="!readonly" :delay="300" transition-duration="0">
				Save
			</q-tooltip>
		</q-btn>
	</template>
</q-input>
<div v-else class="artisan-kv-table">
	<q-table
		class="fit bg-background text-text"
		:ref="table => table$ = <QTable>table"
		:columns="columns$"
		hide-no-data
		:filter="pagination$.filter"
		:filter-method="filterRows"
		:rows="allRows$"
		v-model:pagination="pagination$"
		dense flat square
		:table-style="{minHeight: (table$ && table$.filteredSortedRows.length > pagination$.rowsPerPage)
			? (((pagination$.rowsPerPage + 1) * 49 - 1) + 'px') : 'initial'}"
		@keydown="keyNav($event)"
	>
		<template #header-cell-disable="props">
			<q-th auto-width :props="props">
				<q-checkbox
					v-model="rowsEnable$"
					:disable="readonly || !rows$.length || !!pagination$.filter?.query"
					color="text"
				/>
			</q-th>
		</template>
		<template #header-cell-actions="props">
			<q-th auto-width :props="props">
				<div class="row no-wrap gap-sm justify-end items-center">
					<slot/>
					<q-btn
						v-if="!multipartForm"
						icon="mdi-text-box-edit-outline"
						:disable="!!pagination$.filter?.query"
						flat round color="text" :ripple="ripple$"
						@click.passive="textMode$ = true"
					>
						<q-tooltip
							v-if="!pagination$.filter?.query"
							:delay="300" transition-duration="0"
						>
							Text View
						</q-tooltip>
					</q-btn>
				</div>
			</q-th>
		</template>
		<template #body-cell="props">
			<q-td :auto-width="!props.col.label" :props="props" no-hover>
				<template v-if="props.col.name === 'disable'">
					<q-checkbox
						v-if="props.row !== ghostRow"
						v-model="props.row[props.col.name]"
						:true-value="false" :false-value="true"
						:disable="readonly"
						color="text"
					/>
				</template>
				<template v-else-if="props.col.name !== 'actions'">
					<file-input-field
						v-if="multipartForm && props.col.name === 'value' && Array.isArray(props.row.value)"
						:ref="input => storeInput(props.col.name, props.rowIndex, input)"
						v-model="props.row.value"
						:readonly="readonly"
					>
						<template #after/>
					</file-input-field>
					<q-input
						v-else
						class="shadow-text-always"
						spellcheck="false" autocomplete="off"
						:ref="input => storeInput(props.col.name, props.rowIndex, input)"
						:shadow-text="props.row[props.col.name] ? ' ' : props.col.label"
						v-model="props.row[props.col.name]"
						:disable="!readonly && props.row === ghostRow && !!pagination$.filter?.query"
						:readonly="readonly"
						borderless hide-bottom-space dense
						input-class="artisan-mono"
					/>
				</template>
				<div v-else class="row no-wrap gap-sm justify-end items-center">
					<q-btn
						v-if="multipartForm"
						:icon="Array.isArray(props.row.value) ? 'mdi-paperclip-remove' : 'mdi-paperclip'"
						:disable="readonly || props.row === ghostRow && !!pagination$.filter?.query"
						flat round color="text" :ripple="ripple$"
						@click.passive="switchValueInput(props.rowIndex)"
					>
						<q-tooltip
							v-if="!(readonly || props.row === ghostRow && !!pagination$.filter?.query)"
							:delay="300" transition-duration="0"
						>
							{{Array.isArray(props.row.value) ? 'Remove Files' : 'Add Files'}}
						</q-tooltip>
					</q-btn>
					<q-btn
						v-if="!readonly && !(hideAdd && props.row === ghostRow)"
						:icon="props.row !== ghostRow ? 'mdi-trash-can-outline' : 'mdi-plus'"
						:disable="readonly || props.row === ghostRow && !!pagination$.filter?.query"
						flat round color="text" :ripple="ripple$"
						@click.passive="props.row !== ghostRow ? rows$.splice(props.rowIndex, 1) : addRow()"
					>
						<q-tooltip
							v-if="!(readonly || props.row === ghostRow && !!pagination$.filter?.query)"
							:delay="300" transition-duration="0"
						>
							{{props.row !== ghostRow ? 'Remove' : 'Add'}}
						</q-tooltip>
					</q-btn>
				</div>
			</q-td>
		</template>
		<template #bottom="scope">
			<div class="grow q-pa-toolbar row no-wrap gap-sm">
				<q-input
					class="fit interactive-prepend"
					spellcheck="false" autocomplete="off"
					label="Search"
					:shadow-text="filterRaw$?.query ? ' ' : filterRaw$?.regex
						? '/pattern/flags (JS regex)' : 'Fuzzy'"
					:model-value="filterRaw$?.query"
					@update:model-value="setFilter({query: <string>$event})"
					:disable="!rows$.length && !filterRaw$?.query"
					borderless hide-bottom-space dense
					input-class="artisan-mono"
				>
					<template #prepend>
						 <q-btn
						 	v-if="!filterError$"
							:icon="filterRaw$?.regex ? 'mdi-regex' : 'mdi-magnify'"
							flat round color="text" :ripple="ripple$"
							@click.passive="setFilter({regex: !filterRaw$?.regex})"
						>
							<q-tooltip :delay="300" transition-duration="0">
								{{filterRaw$?.regex ? 'Use Fuzzy Search' : 'Use Regex Search'}}
							</q-tooltip>
						</q-btn>
						<q-icon v-else class="q-px-sm" name="mdi-alert-outline" color="text"/>
					</template>
				</q-input>
				<q-pagination
					v-if="scope.pagesNumber - 1"
					class="no-shrink"
					input
					v-model="pagination$.page"
					:max="scope.pagesNumber"
					color="text" round :ripple="ripple$"
				/>
			</div>
		</template>
	</q-table>
	<q-resize-observer
		:ref="ref => resize$ = <QResizeObserver>ref"
		debounce="0" @resize="updateHeight(tableHeight ?? $event.height)"
	/>
</div>
</template>

<style scoped lang="scss">
.shadow-text-3 {
	:deep(.q-field__shadow) {
		white-space: pre;
	}

	:deep(.q-field__control) {
		// default + 2 lines
		min-height: 78px !important;
	}
}

.artisan-file-input-field {
	margin: -4px -4px -4px -8px;
    height: 48px;

	:deep(.q-file) {
		padding: 4px 4px 4px 8px;
	}

	:deep(.q-file__dnd) {
		outline-offset: 3px !important;
		left: -4px;
	}
}

.q-table__container :deep(th.sortable):focus-visible {
	outline: none;
	background-color: var(--color-text);
	color: var(--color-background);
}

.q-table__container :deep(.q-table__bottom) {
	border-top: none;
	min-height: 0;
	padding: 0 6px;

	.interactive-prepend .q-field__control-container {
		margin-left: 8px;
	}

	.q-pagination {
		padding-right: 4px;
	}
}
</style>

<script setup lang="ts">
import {computed, nextTick, onMounted, ref, shallowRef, watch} from 'vue'
import {debounce, type QResizeObserver, type QTable} from 'quasar'
import {syncRef, useFocusWithin} from '@vueuse/core'
import fuzzysort from 'fuzzysort'
import {FileInputField, useUiStore, type ReqKV} from '@'

const
	{ripple$} = useUiStore(),

	table$ = shallowRef<QTable>(),

	{focused: tableFocused$} = useFocusWithin(computed(() => table$.value?.$el)),

	inputs: Record<string, any> = {},

	resize$ = shallowRef<QResizeObserver>(),

	$props = defineProps<{
		readonly?: boolean | undefined,
		multipartForm?: boolean | undefined,
		hideAdd?: boolean | undefined,
		hideColumns?: string[] | string | undefined,
		tableHeight?: number | undefined,
	}>(),

	watcherHeight = watch($props, ({tableHeight: height}) => {
		if (height === undefined)
			resize$.value?.trigger(true)
		else
			updateHeight(height)
	}),

	textMode$ = defineModel<boolean>('text-mode', {required: true}),
	text$ = defineModel<string>('text-value', {required: true}),

	columns = [
		{name: 'disable'},
		{name: 'key', label: 'Name', sortable: true},
		{name: 'value', label: 'Value', sortable: true},
		{name: 'actions', align: 'right' as 'right'},
	].map(column => ({
		label: '',
		align: 'left' as 'left',
		sortable: false,
		sort(a: any, b: any) {
			[a, b] = [a, b].map(cell => Array.isArray(cell) ? `Files (${cell.length})` : cell)
			return (a?.toString() ?? '').localeCompare(b?.toString() ?? '', undefined, {numeric: true})
		},
		...column,
		field: column.name
	})),

	columns$ = computed(() => {
		const
			{hideColumns} = $props,
			names = Array.isArray(hideColumns) ? hideColumns
				: hideColumns !== undefined ? [hideColumns] : []
		return columns.filter(({name}) => !names.includes(name))
	}),

	rows$ = defineModel<ReqKV[] | ReqKV<string | File[]>[]>({required: true}),

	watcherDeepModel = watch(rows$, (value, oldValue) => {
		if (value === oldValue)
			rows$.value = [...rows$.value]
		updateText()
	}, {deep: true}),

	watcherTextMode = watch(textMode$, (value, oldValue) => {
		if (value !== oldValue)
			updateText()
	}, {immediate: true}),

	ghostRow = {
		set key(key: string) {
			addRow({key})
		},
		set value(value: string) {
			addRow({value})
		},
	},

	allRows$ = computed(() => [
		...rows$.value,
		...(!$props.readonly || !rows$.value.length) ? [ghostRow] : [],
	]),

	pagination$ = defineModel<{
		sortBy?: string | null,
		descending?: boolean,
		filter?: Partial<{query: string, regex: boolean}> | undefined,
		rowsPerPage: number,
		page: number,
	}>('pagination', {required: true}),

	filterRaw$ = ref<typeof pagination$['value']['filter']>(),

	filterError$ = ref(false),

	syncFilter = syncRef(filterRaw$, computed(() => pagination$.value.filter), {direction: 'rtl', immediate: true}),

	rowsEnable$ = computed({
		get: () => {
			const
				total = rows$.value.length,
				enable = rows$.value.filter(({disable}) => !disable).length
			return total ? (total === enable ? true : enable ? null : false) : false
		},
		set: value => rows$.value = rows$.value.map(row => ({...row, disable: !value})),
	})

onMounted(() => {
	const
		pagination = pagination$.value,
		{length} = rows$.value
	if (pagination.rowsPerPage * (pagination.page - 1) >= length)
		pagination.page = 1
})

function updateText() {
	if (textMode$.value)
		text$.value = rows$.value.map(({disable, key, value}) =>
			`${disable ? '//' : ''}${key || '<name>'}${value ? '\n' : ''}${value}`
		).join('\n\n')
}

function saveText(cancel = false) {
	if (!cancel)
		rows$.value = text$.value.split('\n\n').filter(row => row).map(row => {
			const
				[key, value] = row.split('\n') as [string, string | undefined],
				disable = key.startsWith('//')
			return {
				disable,
				key: disable ? key.slice(2) : key,
				value: value ?? '',
			}
		})
	textMode$.value = false
	if (!cancel)
		text$.value = ''
}

function updateHeight(height: number) {
	const
		pagination = pagination$.value,
		size = pagination.rowsPerPage,
		newSize = Math.max(1, Math.floor((height / 49) - 2))
	pagination.rowsPerPage = newSize
	pagination.page = Math.round((pagination.page - 1) * size / newSize) + 1
}

function keyNav(event: KeyboardEvent) {
	if (tableFocused$.value) {
		const table = table$.value
		switch (event.key.toLowerCase()) {
			case 'pageup':
				table?.prevPage()
				break
			case 'pagedown':
				table?.nextPage()
				break
			case 'home':
				table?.firstPage()
				break
			case 'end':
				table?.lastPage()
				break
			default:
				return
		}
		event.preventDefault()
		event.stopPropagation()
	}
}

function storeInput(column: string, row: number, input: any) {
	inputs[`input-${column}-${row}`] = input
}

async function focusInput(column: string, row: number) {
	await nextTick()
	const input = inputs[`input-${column}-${row}`]
	input?.focus()
	input?.select?.()
}

async function switchValueInput(row: number) {
	const kv = rows$.value[row] ?? ghostRow
	kv.value = Array.isArray(kv.value) ? '' : []
	focusInput('value', row)
}

function addRow(value?: Partial<ReqKV | ReqKV<string | File[]>>) {
	rows$.value.push({disable: false, key: '', value: '' as any, ...value})
}

const filterDebounced = debounce((filter: NonNullable<typeof pagination$['value']['filter']>) => {
	const pagination = pagination$.value
	pagination.filter = Object.assign({}, pagination.filter ?? {}, filter)
}, 300, false)

function setFilter(filter: NonNullable<typeof pagination$['value']['filter']>) {
	filterRaw$.value = Object.assign({}, filterRaw$.value ?? {}, filter)
	filterDebounced(filter)
}

function filterRows(
	rows: Readonly<typeof rows$['value']>,
	filter: NonNullable<typeof pagination$['value']['filter']>,
	..._args: any
) {
	if (!filter.query || filter.regex && (
		!filter.query.startsWith('/') || filter.query.indexOf('/') === filter.query.lastIndexOf('/')
	)) {
		filterError$.value = false
		return rows
	}
	try {
		const
			view = rows.map(row => ({
				key: row.key,
				value: Array.isArray(row.value) ? row.value.map(({name}) => name).join('\n') : row.value,
				row,
			})),
			regex = filter.regex ? new RegExp(
				filter.query.slice(1, filter.query.lastIndexOf('/')),
				filter.query.slice(filter.query.lastIndexOf('/') + 1),
			) : null,
			result = regex
				? view
					.filter(({key, value}) =>
						[key, value].some(cell => regex.test(cell))
					)
					.map(({row}) => row)
				: [...fuzzysort.go(filter.query, view, {keys: ['key', 'value']})]
					.sort(({score: a}, {score: b}) => b - a)
					.map(({obj}) => obj.row)
		if (!result.includes(ghostRow as any) && !($props.readonly && result.length))
			result.push(ghostRow as any)
		filterError$.value = false
		return result
	}
	catch {
		filterError$.value = true
		return [ghostRow]
	}
}
</script>
