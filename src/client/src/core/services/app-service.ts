export class AppService {
	/** `formatNumber` + B..TiB */
	static formatDataSize(bytes: number, fractionDigits = 1) {
		const
			power = Math.floor(Math.min(Math.log2(bytes) / 10, 4)),
			number = bytes / (1024 ** power)
		return AppService.formatNumber(number, fractionDigits)
			+ '\xA0' + ['B', 'KiB', 'MiB', 'GiB', 'TiB'][power]
	}

	/** 1234567 => 1 234 567 */
	static formatNumber(number: number, fractionDigits = 0) {
		const
			[integer, fraction] = (
				+number?.toFixed(fractionDigits)
			)?.toString().split('.'),
			formatted = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, '\xA0')
		return fraction ? `${formatted}.${fraction}` : formatted
	}

	/** recursive `Object.freeze()` */
	static freeze<T extends Object>(object: T) {
		if (object === null || typeof object !== 'object')
			return object
		for (const key of Reflect.ownKeys(object))
			AppService.freeze(object[key as keyof object])
		return Object.freeze(object)
	}

	static importFiles({multiple, accept, binary}: {multiple?: boolean, accept?: string, binary?: boolean} = {}) {
		return new Promise<null | string[] | ArrayBuffer[]>((resolve, reject) => {
			const input = document.createElement('input')
			input.type = 'file'
			if (multiple !== undefined)
				input.multiple = multiple
			if (accept !== undefined)
				input.accept = accept
			input.onchange = async () => {
				try {
					const files = input.files
						? Array(input.files.length).fill(null).map((_, index) => input.files![index]!)
						: []
					if (!files.length)
						resolve(null)
					else
						resolve(binary
							? await Promise.all(files.map(file => file.arrayBuffer()))
							: await Promise.all(files.map(file => file.text()))
						)
				}
				catch (error) {
					reject(error)
				}
			}
			input.click()
		})
	}

	/** relative or protocol-less */
	static resolveUrl(url: string, base = location.toString(), protocol = 'http') {
		try {
			const isRelative = url === '.' ||
				url.startsWith('/') ||
				url.startsWith('./') ||
				url.startsWith('../') ||
				url.startsWith('?') ||
				url.startsWith('#')
			return isRelative ? new URL(url, base).href :
				url.match(/^\w+:\/\//) ? url : (protocol + '://' + url)
		}
		catch {
			return ''
		}
	}

	/** parseable http(s) */
	static isValidUrl(value: string) {
		try {
			const url = new URL(value)
			return ['http:', 'https:'].includes(url.protocol)
		}
		catch {
			return false
		}
	}
}
