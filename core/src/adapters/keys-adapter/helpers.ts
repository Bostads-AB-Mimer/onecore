import createClient from 'openapi-fetch'
import { z } from 'zod'
import Config from '../../common/config'
import { paths } from './generated/api-types'
import {
  CommonErr,
  AdapterResult,
  PaginatedResponse,
  PaginationMetaSchema,
  PaginationLinksSchema,
} from './types'

export const client = () =>
  createClient<paths>({
    baseUrl: Config.keysService.url,
    headers: { 'Content-Type': 'application/json' },
  })

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

export function parsePaginated<S extends z.ZodTypeAny>(
  itemSchema: S,
  data: unknown
): PaginatedResponse<z.output<S>> {
  const obj = data as Record<string, unknown>
  return {
    content: z.array(itemSchema).parse(obj.content),
    _meta: PaginationMetaSchema.parse(obj._meta),
    _links: z.array(PaginationLinksSchema).parse(obj._links),
  }
}
