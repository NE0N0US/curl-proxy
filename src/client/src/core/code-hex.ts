import {LanguageSupport, StreamLanguage, type StreamParser} from '@codemirror/language'

const parser: StreamParser<{column: 'address' | 'hex' | 'ascii'}> = {
	startState() {
		return {column: 'address'}
	},
	token(stream, state) {
		if (stream.sol())
			state.column = 'address'
		switch (state.column) {
			case 'address':
				if (stream.match(/^[0-9A-Fa-f]+  /)) {
					state.column = 'hex'
					return 'annotation'
				}
				break
			case 'hex':
				if (stream.match(/^([0-9A-Fa-f]{2} )+ /)) {
					state.column = 'ascii'
					return 'number'
				}
				break
		}
		stream.skipToEnd()
		return null
	},
}

export function hex(){
	return new LanguageSupport(StreamLanguage.define(parser))
}
