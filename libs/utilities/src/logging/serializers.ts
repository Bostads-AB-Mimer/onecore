import { stdSerializers } from 'pino'

import { redactHeaders } from './redactHeaders'

// Axios errors and responses carry the request config (headers, body, auth)
// and the raw Node request (its header string includes Authorization). Logged
// as they are, client secrets, tokens and API keys end up in Elasticsearch.
// These serializers keep what helps debugging and drop the rest.
//
// Covered: an axios error or response logged as the object itself, under
// `err`, `error`, `response`, or one level down under any other key (the
// redact paths). Not covered: one nested deeper, e.g. `{ details: { err } }`
// or `{ errors: [err] }` — nothing logs that way today; log errors under
// `err` instead.
//
// A serializer must never throw: a throw escapes logger.error() and the line
// is lost. Everything here falls back instead of throwing.

type AxiosLike = {
  message?: string
  name?: string
  code?: string
  stack?: string
  status?: number
  config?: { method?: unknown; url?: string; baseURL?: string }
  response?: { status?: number; data?: unknown }
  data?: unknown
  isAxiosError?: boolean
}

const MAX_RESPONSE_DATA = 2000

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** An axios error, or an axios response (it has config, headers and status). */
const isAxiosLike = (value: unknown): value is AxiosLike =>
  isObject(value) &&
  (value.isAxiosError === true ||
    (isObject(value.config) && 'headers' in value && 'status' in value))

const cap = (text: string) =>
  text.length > MAX_RESPONSE_DATA
    ? `${text.slice(0, MAX_RESPONSE_DATA)}…`
    : text

/** Error bodies help debugging (e.g. Keycloak's error_description); capped.
 * A stream response (responseType 'stream') or circular data can't be
 * stringified and is not attempted. */
const responseDataText = (data: unknown): string | undefined => {
  if (data === undefined || data === null) return undefined
  if (typeof data === 'string') return cap(data)
  if (Buffer.isBuffer(data))
    return cap(data.subarray(0, MAX_RESPONSE_DATA).toString('utf8'))
  if (data instanceof ArrayBuffer)
    return cap(Buffer.from(data.slice(0, MAX_RESPONSE_DATA)).toString('utf8'))
  if (isObject(data) && typeof data.pipe === 'function') return '[stream]'
  try {
    return cap(JSON.stringify(data))
  } catch {
    return '[unserializable]'
  }
}

const upper = (method: unknown) =>
  typeof method === 'string' ? method.toUpperCase() : undefined

const summarizeAxios = (value: AxiosLike) => {
  const isError = value.isAxiosError === true
  return {
    type: isError ? 'AxiosError' : 'AxiosResponse',
    message: value.message,
    code: value.code,
    status: isError ? value.response?.status : value.status,
    method: upper(value.config?.method),
    url: value.config?.url,
    baseURL: value.config?.baseURL,
    responseData: responseDataText(isError ? value.response?.data : value.data),
    stack: value.stack,
  }
}

/** Runs a serializer, falling back to a bare description if it throws. */
const safely =
  (serialize: (value: unknown) => unknown) =>
  (value: unknown): unknown => {
    try {
      return serialize(value)
    } catch {
      return {
        type: 'Unserializable',
        message: value instanceof Error ? value.message : undefined,
      }
    }
  }

/** For `err` and `error`: axios errors and responses are summarized, other
 * errors go through pino's standard serializer (which keeps only the message
 * and stack of a `cause`). */
export const serializeError = safely((value) => {
  if (isAxiosLike(value)) return summarizeAxios(value)
  return value instanceof Error ? stdSerializers.err(value) : value
})

/** An axios request config: only where the request went. */
const serializeConfig = safely((value) =>
  isObject(value) && 'headers' in value
    ? { method: upper(value.method), url: value.url, baseURL: value.baseURL }
    : value
)

/** A Node ClientRequest (from an axios response or error) has its raw header
 * string in it; Koa's own `request: { path, method, ... }` passes through. */
const serializeRequest = safely((value) =>
  isObject(value) && typeof value.getHeader === 'function'
    ? { method: value.method, host: value.host, path: value.path }
    : value
)

/** `{ response }` holding an axios response is summarized; anything else
 * passes through. */
const serializeResponse = safely((value) =>
  isAxiosLike(value) ? summarizeAxios(value) : value
)

/**
 * Pino serializers for the top-level keys errors and axios objects end up
 * under: `logger.error(err)`, `{ err }`, `{ error }`, `{ response }`, and an
 * axios response or error logged as the object itself (its `config`,
 * `request` and `headers` become top-level keys).
 */
export const serializers = {
  err: serializeError,
  error: serializeError,
  response: serializeResponse,
  config: serializeConfig,
  request: serializeRequest,
  headers: safely((value) => (isObject(value) ? redactHeaders(value) : value)),
}

/**
 * Backstop for axios objects logged under any other key, one level down
 * (e.g. `{ emailErr }`): their config and raw request are censored.
 */
export const redactPaths = [
  '*.config.headers',
  '*.config.data',
  '*.config.auth',
  '*.request',
  '*.response.config',
  '*.response.request',
  '*.response.headers',
]
