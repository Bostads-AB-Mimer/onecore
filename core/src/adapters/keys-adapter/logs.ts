import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail, parsePaginated } from './helpers'
import {
  Log,
  CreateLogRequest,
  LogSchema,
  PaginatedResponse,
  CommonErr,
  AdapterResult,
} from './types'

export const LogsApi = {
  list: async (
    query: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<Log>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/logs', {
        params: { query: query as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(LogSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /logs failed')
      return fail('unknown')
    }
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<Log>, 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET('/logs/search', {
        params: { query: searchParams as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(LogSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /logs/search failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<Log, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/logs/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(LogSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /logs/{id} failed')
      return fail('unknown')
    }
  },

  getByObjectId: async (
    objectId: string
  ): Promise<AdapterResult<Log[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/logs/object/{objectId}',
        {
          params: { path: { objectId } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LogSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /logs/object failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: Partial<CreateLogRequest>
  ): Promise<AdapterResult<Log, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().POST('/logs', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(LogSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /logs failed')
      return fail('unknown')
    }
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<Log>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/logs/rental-object/{rentalObjectCode}',
        {
          params: {
            path: { rentalObjectCode },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(LogSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /logs/rental-object failed')
      return fail('unknown')
    }
  },

  getByContactId: async (
    contactId: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<Log>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/logs/contact/{contactId}',
        {
          params: {
            path: { contactId },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(LogSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /logs/contact failed')
      return fail('unknown')
    }
  },
}
