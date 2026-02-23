import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail, parsePaginated } from './helpers'
import {
  KeyBundle,
  KeyBundleDetailsResponse,
  BundleWithLoanedKeysInfo,
  KeyBundleSchema,
  KeyBundleDetailsResponseSchema,
  BundleWithLoanedKeysInfoSchema,
  PaginatedResponse,
  CommonErr,
  AdapterResult,
} from './types'

export const KeyBundlesApi = {
  list: async (
    query: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<KeyBundle>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/key-bundles', {
        params: { query: query as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(KeyBundleSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-bundles failed')
      return fail('unknown')
    }
  },

  search: async (
    searchParams: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<PaginatedResponse<KeyBundle>, 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET(
        '/key-bundles/search',
        {
          params: { query: searchParams as any },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated(KeyBundleSchema, data))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-bundles/search failed')
      return fail('unknown')
    }
  },

  getByKey: async (
    keyId: string
  ): Promise<AdapterResult<KeyBundle[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-bundles/by-key/{keyId}',
        {
          params: { path: { keyId } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(KeyBundleSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-bundles/by-key failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyBundle, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-bundles/{id}',
        {
          params: { path: { id } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyBundleSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-bundles/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: Partial<KeyBundle>
  ): Promise<
    AdapterResult<KeyBundle, 'bad-request' | 'conflict' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().POST('/key-bundles', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyBundleSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /key-bundles failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: Partial<KeyBundle>
  ): Promise<
    AdapterResult<
      KeyBundle,
      'not-found' | 'bad-request' | 'conflict' | CommonErr
    >
  > => {
    try {
      const { data, error, response } = await client().PUT(
        '/key-bundles/{id}',
        {
          params: { path: { id } },
          body: payload as any,
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyBundleSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /key-bundles/{id} failed')
      return fail('unknown')
    }
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    try {
      const { error, response } = await client().DELETE('/key-bundles/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(undefined)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: DELETE /key-bundles/{id} failed')
      return fail('unknown')
    }
  },

  getWithLoanStatus: async (
    id: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<
    AdapterResult<KeyBundleDetailsResponse, 'not-found' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().GET(
        '/key-bundles/{id}/keys-with-loan-status',
        {
          params: {
            path: { id },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyBundleDetailsResponseSchema.parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /key-bundles/{id}/keys-with-loan-status failed'
      )
      return fail('unknown')
    }
  },

  getByContactWithLoanedKeys: async (
    contactCode: string
  ): Promise<AdapterResult<BundleWithLoanedKeysInfo[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-bundles/by-contact/{contactCode}/with-loaned-keys',
        {
          params: { path: { contactCode } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(BundleWithLoanedKeysInfoSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /key-bundles/by-contact/with-loaned-keys failed'
      )
      return fail('unknown')
    }
  },
}
