export type StringRecord = Record<string, string>

export type Constructable<T = any> = new (...args: any[]) => T

export type Bytes = Uint8Array<ArrayBuffer>

/** `Request` | `Response` */
export type Body = ReadableStream<Bytes> | null | undefined
