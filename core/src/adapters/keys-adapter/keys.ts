import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail, parsePaginated } from './helpers'
import {
  Key,
  KeyDetails,
  KeySchema,
  KeyDetailsSchema,
  PaginatedResponse,
  CommonErr,
  AdapterResult,
} from './types'

export const KeysApi = {
  list: async (
    query: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<Key>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/keys', {
        params: { query: query as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(KeySchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /keys failed')
      return fail('unknown')
    }
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<Key>, 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET('/keys/search', {
        params: { query: searchParams as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(KeySchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /keys/search failed')
      return fail('unknown')
    }
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<KeyDetails[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/keys/by-rental-object/{rentalObjectCode}',
        {
          params: {
            path: { rentalObjectCode },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(KeyDetailsSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /keys/by-rental-object failed'
      )
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Key, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/keys/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeySchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /keys/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: Partial<Key>
  ): Promise<AdapterResult<Key, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().POST('/keys', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeySchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /keys failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: Partial<Key>
  ): Promise<AdapterResult<Key, 'not-found' | 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().PUT('/keys/{id}', {
        params: { path: { id } },
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeySchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /keys/{id} failed')
      return fail('unknown')
    }
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    try {
      const { error, response } = await client().DELETE('/keys/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(undefined)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: DELETE /keys/{id} failed')
      return fail('unknown')
    }
  },

  bulkUpdateFlex: async (
    rentalObjectCode: string,
    flexNumber: number
  ): Promise<AdapterResult<number, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().POST(
        '/keys/bulk-update-flex',
        {
          body: { rentalObjectCode, flexNumber } as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.content as number)
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: POST /keys/bulk-update-flex failed'
      )
      return fail('unknown')
    }
  },

  bulkDelete: async (
    keyIds: string[]
  ): Promise<AdapterResult<number, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().POST(
        '/keys/bulk-delete',
        {
          body: { keyIds } as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.content as number)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /keys/bulk-delete failed')
      return fail('unknown')
    }
  },

  bulkUpdate: async (
    keyIds: string[],
    updates: {
      keyName?: string
      flexNumber?: number | null
      keySystemId?: string | null
      rentalObjectCode?: string
      disposed?: boolean
      notes?: string | null
      clearNotes?: boolean
    }
  ): Promise<AdapterResult<number, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().PUT(
        '/keys/bulk-update',
        {
          body: { keyIds, updates } as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.content as number)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /keys/bulk-update failed')
      return fail('unknown')
    }
  },
}
