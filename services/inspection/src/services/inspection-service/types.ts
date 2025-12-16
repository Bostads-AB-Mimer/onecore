export type AdapterResult<T, E> = { ok: true; data: T } | { ok: false; err: E }
