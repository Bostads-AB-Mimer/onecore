import createClient from 'openapi-fetch'

import Config from '../../common/config'
import { AdapterResult } from '../types'
import { paths } from './generated/api-types'

// Typed client for the communication service's OpenAPI routes (the okapi
// router). Legacy routes in index.ts still use axios.
export const client = () =>
  createClient<paths>({
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

export function ok<T>(data: T): AdapterResult<T, never> {
  return { ok: true, data }
}

export function fail<E extends CommonErr>(err: E): AdapterResult<never, E> {
  return { ok: false, err }
}
