import fs from 'node:fs'
import path from 'node:path'
import stream from 'node:stream'

import {StringRecord} from './types'

const fileTextCache: Record<string, string> = {}

// #region - functions

export function fileText(filename: string, cache = true) {
	if (!cache)
		delete fileTextCache[filename]
	return fileTextCache[filename] ??=
		fs.readFileSync(path.join(process.cwd(), filename)).toString()
}

export function isArray<T = any>(value: any, ofClass: Function | undefined = String): value is T[] {
	return Array.isArray(value) && (!ofClass || !!value.length &&
		!value.some(item => item?.constructor.name !== ofClass?.name)
	)
}

export function isRecord<K extends keyof any, V = any>(
	value: any,
	valuesClass: Function | undefined = String,
	keysType: string | undefined = 'string'
): value is Record<K, V> {
	const isObject = typeof value === 'object' && value && !isArray(value, undefined)
	if (!isObject)
		return false
	let valuesOfClass = true, keysOfType = true
	if (valuesClass) {
		const values = Object.values(value)
		valuesOfClass = !!values.length && !values.some(value =>
			value?.constructor.name !== valuesClass?.name
		)
		if (!valuesOfClass)
			return false
	}
	if (keysType) {
		const keys = Object.keys(value)
		keysOfType = !!keys.length && !keys.some(key => typeof key !== keysType)
		if (!keysOfType)
			return false
	}
	return valuesOfClass && keysOfType
}

export function tryParse<T = any>(json: string | null | undefined, isValid: Function, ...args: any[]) {
	if (!json)
		return undefined
	try {
		const value = JSON.parse(json)
		if (isValid(value, ...args))
			return value as T
	}
	catch {}
}

/** `["a", "b"]` */
export function formatStringArray(array: readonly string[]) {
	return `["${array.join('", "')}"]`
}

/** `{"a": "b", "c": "d"}` */
export function formatStringRecord(record: StringRecord) {
	return JSON.stringify(record, undefined, ' ').replace(/(?:(?<={)\n )|\n/g, '')
}

/** https://lodash.com/docs/#escapeRegExp, except `"` */
export function escapeRegex(text: string) {
	return text.replace(/[\^\$\.\*\+\?\(\)\[\]\{\}\|]/g, char => '\\' + char)
}

/** https://lodash.com/docs/#escape */
export function escapeHtml(text: string) {
	return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
}

export function getAbortError(message = 'Aborted') {
	return new DOMException(message, 'AbortError')
}

/** @throws {any} if aborted
 * @throws {DOMException} if aborted without `reason`
 */
export function checkAbortSignal(signal?: AbortSignal, message?: string) {
	if (signal?.aborted)
		throw signal.reason ?? getAbortError(message)
}

/** decode base64 */
export function atobStream() {
	let leftover = ''
	return new stream.Transform({
		transform(chunk, _encoding, callback) {
			let text = leftover + chunk.toString('ascii')
			if (/\s/.test(text))
				text = text.replace(/\s+/g, '')
			const length = text.length - (text.length % 4)
			if (length > 0)
				this.push(Buffer.from(text.slice(0, length), 'base64'))
			leftover = text.slice(length)
			callback()
		},
		flush(callback) {
			if (leftover.length)
				this.push(Buffer.from(leftover, 'base64'))
			callback()
		},
	})
}

/** encode base64 */
export function btoaStream() {
	let leftover = Buffer.alloc(0)
	return new stream.Transform({
		transform(chunk, _encoding, callback) {
			chunk = Buffer.concat([leftover, chunk])
			const length = chunk.length - (chunk.length % 3)
			if (length > 0)
				this.push(chunk.subarray(0, length).toString('base64'))
			leftover = chunk.subarray(length)
			callback()
		},
		flush(callback) {
			if (leftover.length)
				this.push(leftover.toString('base64'))
			callback()
		},
	})
}

// #endregion
