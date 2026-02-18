import { logger } from '@onecore/utilities'
import { z } from 'zod'
import {
  client,
  mapFetchError,
  ok,
  fail,
  parsePaginated,
  lenient,
} from './helpers'
import {
  KeyLoan,
  KeyLoanWithDetails,
  CreateKeyLoanRequest,
  UpdateKeyLoanRequest,
  KeyLoanSchema,
  KeyLoanWithDetailsSchema,
  PaginatedResponse,
  CommonErr,
  AdapterResult,
} from './types'

// Lenient schemas that accept null for optional string fields (SQL NULL → undefined)
const LenientKeyLoanSchema = lenient(KeyLoanSchema)
const LenientKeyLoanWithDetailsSchema = lenient(KeyLoanWithDetailsSchema)

export const KeyLoansApi = {
  list: async (): Promise<AdapterResult<KeyLoan[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/key-loans')
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LenientKeyLoanSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-loans failed')
      return fail('unknown')
    }
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<KeyLoan>, 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET(
        '/key-loans/search',
        {
          params: { query: searchParams as any },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(LenientKeyLoanSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-loans/search failed')
      return fail('unknown')
    }
  },

  getByKey: async (
    keyId: string
  ): Promise<AdapterResult<KeyLoan[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-loans/by-key/{keyId}',
        {
          params: { path: { keyId } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LenientKeyLoanSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-loans/by-key failed')
      return fail('unknown')
    }
  },

  getByCard: async (
    cardId: string
  ): Promise<AdapterResult<KeyLoan[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-loans/by-card/{cardId}',
        {
          params: { path: { cardId } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LenientKeyLoanSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-loans/by-card failed')
      return fail('unknown')
    }
  },

  getByRentalObject: async (
    rentalObjectCode: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<KeyLoanWithDetails[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-loans/by-rental-object/{rentalObjectCode}',
        {
          params: {
            path: { rentalObjectCode },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LenientKeyLoanWithDetailsSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /key-loans/by-rental-object failed'
      )
      return fail('unknown')
    }
  },

  get: async (
    id: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<KeyLoan | KeyLoanWithDetails, 'not-found' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET('/key-loans/{id}', {
        params: {
          path: { id },
          query: query as any,
        },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.content as unknown as KeyLoan | KeyLoanWithDetails)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-loans/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: CreateKeyLoanRequest
  ): Promise<
    AdapterResult<KeyLoan, 'bad-request' | 'conflict' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().POST('/key-loans', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(LenientKeyLoanSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /key-loans failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: UpdateKeyLoanRequest
  ): Promise<
    AdapterResult<KeyLoan, 'not-found' | 'bad-request' | 'conflict' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().PUT('/key-loans/{id}', {
        params: { path: { id } },
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(LenientKeyLoanSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /key-loans/{id} failed')
      return fail('unknown')
    }
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    try {
      const { error, response } = await client().DELETE('/key-loans/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(undefined)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: DELETE /key-loans/{id} failed')
      return fail('unknown')
    }
  },

  getByContactWithKeys: async (
    contact: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<KeyLoanWithDetails[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-loans/by-contact/{contact}/with-keys',
        {
          params: {
            path: { contact },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LenientKeyLoanWithDetailsSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /key-loans/by-contact/with-keys failed'
      )
      return fail('unknown')
    }
  },

  getByBundleWithKeys: async (
    bundleId: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<KeyLoanWithDetails[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-loans/by-bundle/{bundleId}/with-keys',
        {
          params: {
            path: { bundleId },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(LenientKeyLoanWithDetailsSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /key-loans/by-bundle/with-keys failed'
      )
      return fail('unknown')
    }
  },

  activate: async (
    id: string
  ): Promise<
    AdapterResult<
      { activated: boolean; keyEventsCompleted: number },
      'not-found' | CommonErr
    >
  > => {
    try {
      const { data, error, response } = await client().POST(
        '/key-loans/{id}/activate',
        {
          params: { path: { id } },
          body: {} as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(
        data as unknown as { activated: boolean; keyEventsCompleted: number }
      )
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: POST /key-loans/{id}/activate failed'
      )
      return fail('unknown')
    }
  },
}
