import { logger } from '@onecore/utilities'
import { client, mapFetchError, ok, fail, parsePaginated } from './helpers'
import {
  KeySystem,
  KeySystemSchema,
  PaginatedResponse,
  CommonErr,
  AdapterResult,
} from './types'

export const KeySystemsApi = {
  list: async (
    query: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<KeySystem>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/key-systems', {
        params: { query: query as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(KeySystemSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-systems failed')
      return fail('unknown')
    }
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<KeySystem>, 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET(
        '/key-systems/search',
        {
          params: { query: searchParams as any },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(KeySystemSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-systems/search failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeySystem, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-systems/{id}',
        {
          params: { path: { id } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeySystemSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-systems/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: Partial<KeySystem>
  ): Promise<
    AdapterResult<KeySystem, 'bad-request' | 'conflict' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().POST('/key-systems', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeySystemSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /key-systems failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: Partial<KeySystem>
  ): Promise<
    AdapterResult<
      KeySystem,
      'not-found' | 'bad-request' | 'conflict' | CommonErr
    >
  > => {
    try {
      const { data, error, response } = await client().PUT(
        '/key-systems/{id}',
        {
          params: { path: { id } },
          body: payload as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeySystemSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /key-systems/{id} failed')
      return fail('unknown')
    }
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    try {
      const { error, response } = await client().DELETE('/key-systems/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(undefined)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: DELETE /key-systems/{id} failed')
      return fail('unknown')
    }
  },
}
