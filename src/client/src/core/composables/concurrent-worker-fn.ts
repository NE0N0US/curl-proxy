import {useWebWorkerFn, type UseWebWorkerOptions, type UseWebWorkerFnReturn} from '@vueuse/core'

export function useConcurrentWorkerFn<T extends (...args: any[]) => any>(
	fn: T,
	options?: UseWebWorkerOptions
) {
	let worker: UseWebWorkerFnReturn<T>
	return (...args: Parameters<T>): ReturnType<T> extends Promise<any>
		? ReturnType<T>
		: Promise<ReturnType<T>> => {
		worker?.workerTerminate()
		worker = useWebWorkerFn(fn, options)
		return worker.workerFn(...args) as any
	}
}
