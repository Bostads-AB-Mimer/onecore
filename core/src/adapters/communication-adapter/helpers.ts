import createClient from 'openapi-fetch'

import Config from '../../common/config'
import { AdapterResult } from '../types'
import { paths } from './generated/api-types'

// Typed client for the communication service's OpenAPI routes (the okapi
// router). Legacy routes in index.ts still use axios. Created once: the client
// holds no per-request state, so there is no reason to rebuild it per call.
export const client = createClient<paths>({
  baseUrl: Config.communicationService.url,
  headers: { 'Content-Type': 'application/json' },
})

export type CommonErr =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'unknown'

export function mapFetchError(response: { status: number }): CommonErr {
  const status = response.status
  if (status === 400) return 'bad-request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  return 'unknown'
}

/**
 * Error body the communication service returns for 4xx/5xx responses: a stable
 * kebab-case code plus zod issues when the request failed validation.
 */
export type UpstreamError = {
  error: string
  issues?: { path: (string | number)[]; message: string }[]
}

/** Adapter result that also carries the upstream error body, so core can proxy it. */
export type ProxiedAdapterResult<T, E> =
  { ok: true; data: T } | { ok: false; err: E; upstream?: UpstreamError }

export function ok<T>(data: T): AdapterResult<T, never> {
  return { ok: true, data }
}

export function fail<E extends CommonErr>(
  err: E,
  upstream?: UpstreamError
): { ok: false; err: E; upstream?: UpstreamError } {
  return { ok: false, err, upstream }
}

/** Narrow openapi-fetch's error value to the service's error body, if it is one. */
export function upstreamError(error: unknown): UpstreamError | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const body = error as Partial<UpstreamError>
  if (typeof body.error !== 'string') return undefined
  return { error: body.error, issues: body.issues }
}
