import vm from 'node:vm'
import {newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline} from 'quickjs-emscripten-core'
import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync'
import {Arena} from 'quickjs-emscripten-sync'

import {Constructable} from './types'

const NATIVE_INSTANCE = Symbol('native')

// #region - functions

/** proxy getter and setter to target */
function proxyProperty<T extends Object>(
	getTarget: (instance: T) => any, name: string, prop: PropertyDescriptor,
	configurable?: boolean, enumerable?: boolean
) {
	return {
		get: 'value' in prop || prop.get ? function(this: T) {
			const value = getTarget(this)[name]
			return typeof value === 'function' ? function(this: T, ...args: any[]) {
				return getTarget(this)[name](...args)
			} : value
		} : undefined,
		set: prop.writable || prop.set ? function(this: T, value: any) {
			getTarget(this)[name] = value
		} : undefined,
		configurable: configurable ?? prop.configurable,
		enumerable: enumerable ?? prop.enumerable,
	} as PropertyDescriptor
}

/** for QuickJS; except `prototype` and `constructor` */
function wrapNativeClass<T extends Object>(NativeClass: Constructable<T>) {
	class WrappedNative {
		[NATIVE_INSTANCE]: T
		constructor(...args: any[]) {
			this[NATIVE_INSTANCE] = new NativeClass(...args)
		}
	}
	Object.getOwnPropertyNames(NativeClass.prototype).forEach(name => {
		if (name !== 'constructor')
			Object.defineProperty(WrappedNative.prototype, name,
				proxyProperty<WrappedNative>(
					wrappedNative => wrappedNative[NATIVE_INSTANCE],
					name,
					Object.getOwnPropertyDescriptor(NativeClass.prototype, name)!
				)
			)
	})
	const factory = (...args: any[]) => new WrappedNative(...args)
	;[WrappedNative, factory].forEach(target => {
		Object.getOwnPropertyNames(NativeClass).forEach(name => {
			if (name !== 'prototype')
				Object.defineProperty(target, name, proxyProperty(
					() => NativeClass,
					name,
					Object.getOwnPropertyDescriptor(NativeClass, name)!
				))
		})
		Object.defineProperty(target, Symbol.hasInstance, {
			value: (wrappedNative: WrappedNative) =>
				wrappedNative[NATIVE_INSTANCE] instanceof NativeClass,
			writable: false,
			configurable: false,
			enumerable: false,
		})
	})
	return factory
}

/** [QuickJS](https://github.com/justjake/quickjs-emscripten) via [wrapper](https://github.com/reearth/quickjs-emscripten-sync)
 * @throws {any}
 */
export async function runSandboxed(
	code: string, expose?: Object, exposeClasses?: Record<string, Constructable>,
	timeout?: number, memoryLimitBytes?: number, useNodeVm?: boolean
) {
	if (useNodeVm)
		return vm.runInNewContext(code, {
			...expose,
			...exposeClasses,
		}, {
			timeout,
			breakOnSigint: true,
			contextCodeGeneration: {strings: false, wasm: false},
		})
	const
		QuickJS = (await newQuickJSWASMModuleFromVariant(RELEASE_SYNC)).newRuntime({
			interruptHandler: timeout ? shouldInterruptAfterDeadline(Date.now() + timeout) : undefined,
			memoryLimitBytes,
		}),
		ctx = QuickJS.newContext(),
		arena = new Arena(ctx, {isMarshalable: true})
	arena.expose({
		...expose,
		...exposeClasses ? Object.fromEntries(Object.entries(exposeClasses).map(([name, nativeClass]) =>
			[name, wrapNativeClass(nativeClass as any)]
		)) : {},
	})
	try {
		const result = arena.evalCode(code)
		return result?.[NATIVE_INSTANCE] ?? result
	}
	finally {
		new Promise(resolve => setTimeout(resolve))
			.then(() => {
				arena.dispose()
				ctx.dispose()
			})
			.catch(() => {})
	}
}

// #endregion
