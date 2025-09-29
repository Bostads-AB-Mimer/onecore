export type AdapterResult<T, E> =
  | { ok: false; err: E; statusCode: number }
  | { ok: true; data: T }
