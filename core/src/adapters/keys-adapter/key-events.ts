import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail } from './helpers'
import {
  KeyEvent,
  CreateKeyEventRequest,
  UpdateKeyEventRequest,
  KeyEventSchema,
  CommonErr,
  AdapterResult,
} from './types'

export const KeyEventsApi = {
  list: async (): Promise<AdapterResult<KeyEvent[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/key-events')
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(KeyEventSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-events failed')
      return fail('unknown')
    }
  },

  getByKey: async (
    keyId: string,
    limit?: number
  ): Promise<AdapterResult<KeyEvent[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-events/by-key/{keyId}',
        {
          params: {
            path: { keyId },
            query: { limit },
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(KeyEventSchema).parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-events/by-key failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyEvent, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/key-events/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyEventSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-events/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: CreateKeyEventRequest
  ): Promise<
    AdapterResult<KeyEvent, 'bad-request' | 'conflict' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().POST('/key-events', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyEventSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /key-events failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: UpdateKeyEventRequest
  ): Promise<
    AdapterResult<KeyEvent, 'not-found' | 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().PUT('/key-events/{id}', {
        params: { path: { id } },
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyEventSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /key-events/{id} failed')
      return fail('unknown')
    }
  },
}
