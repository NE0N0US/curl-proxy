import {minify as minifyJs} from 'terser'
import formatXml from 'xml-formatter';
import {type Options, format as prettify} from 'prettier'
import * as babel from 'prettier/plugins/babel'
import * as estree from 'prettier/plugins/estree'
import * as html from 'prettier/plugins/html'
import * as postcss from 'prettier/plugins/postcss'

const PRETTIER_OPTIONS: Options = {
	printWidth: 120,
	tabWidth: 4,
	useTabs: true,
	semi: false,
	singleQuote: true,
	quoteProps: 'preserve',
	trailingComma: 'es5',
	bracketSpacing: false,
	arrowParens: 'avoid',
}

export class CodeService {
	static async minify(value: string, lang: string) {
		switch (lang) {
			case 'javascript':
				return (await minifyJs(value, {
					compress: false,
					mangle: false,
					format: {
						ecma: 2025,
						keep_numbers: true,
						quote_style: 3,
					},
				})).code ?? ''
			case 'json':
				return JSON.stringify(JSON.parse(value))
			case 'xml':
				return formatXml.minify(value)
			default:
				return value
		}
	}

	static async prettify(value: string, lang: string) {
		switch (lang) {
			case 'javascript':
				return (await prettify(value, {
					parser: 'babel',
					plugins: [babel, estree],
					...PRETTIER_OPTIONS,
				})).trimEnd()
			case 'json':
				return JSON.stringify(JSON.parse(value), undefined, '\t')
			case 'html':
				return (await prettify(value, {
					parser: 'html',
					plugins: [html, postcss, babel, estree],
					...PRETTIER_OPTIONS,
				})).trimEnd()
			case 'xml':
				return formatXml(value, {indentation: '\t', lineSeparator: '\n'})
			default:
				return value
		}
	}
}
