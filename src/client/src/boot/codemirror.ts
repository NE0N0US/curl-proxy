import {defineBoot} from '#q-app'
import VueCodemirror from 'vue-codemirror'
import {dropCursor, keymap, lineNumbers} from '@codemirror/view'
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands'
import {bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, syntaxHighlighting} from '@codemirror/language'
import {highlightSelectionMatches} from '@codemirror/search'
import {tags} from "@lezer/highlight"

const artisanHighlightStyle = HighlightStyle.define([
	{
		tag: [tags.comment, tags.meta, tags.punctuation],
		color: 'var(--color-disabled)',
	},
	{
		tag: [tags.keyword, tags.standard(tags.name), tags.operator, tags.escape],
		color: 'var(--color-code-syntax)',
	},
	{
		tag: [tags.name, tags.tagName],
		color: 'var(--color-code-entity)',
	},
	{
		tag: [tags.typeName, tags.propertyName, tags.function(tags.name)],
		color: 'var(--color-text)',
	},
	{
		tag: [tags.literal, tags.null, tags.atom],
		color: 'var(--color-code-value)',
	},
])

export default defineBoot(({app}) => {
	app.use(VueCodemirror, {extensions: [
		keymap.of(defaultKeymap),
		indentOnInput(),
		dropCursor(),
		history(),
		keymap.of(historyKeymap),
		lineNumbers(),
		foldGutter({
			markerDOM: open => {
				const element = document.createElement('i')
				element.setAttribute('class', `q-icon mdi mdi-${open ? 'chevron-down' : 'chevron-right'}`)
				element.setAttribute('aria-hidden', 'true')
				return element
			},
		}),
		keymap.of(foldKeymap),
		highlightSelectionMatches(),
		bracketMatching(),
		syntaxHighlighting(artisanHighlightStyle),
	]})
})
