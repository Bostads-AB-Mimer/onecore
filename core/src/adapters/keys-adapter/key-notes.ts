import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail } from './helpers'
import { KeyNote, KeyNoteSchema, CommonErr, AdapterResult } from './types'

export const KeyNotesApi = {
  getByRentalObjectCode: async (
    rentalObjectCode: string
  ): Promise<AdapterResult<KeyNote[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/key-notes/by-rental-object/{rentalObjectCode}',
        {
          params: { path: { rentalObjectCode } },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(KeyNoteSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /key-notes/by-rental-object failed'
      )
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<KeyNote, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/key-notes/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyNoteSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /key-notes/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: Partial<KeyNote>
  ): Promise<AdapterResult<KeyNote, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().POST('/key-notes', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyNoteSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: POST /key-notes failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: Partial<KeyNote>
  ): Promise<
    AdapterResult<KeyNote, 'not-found' | 'bad-request' | CommonErr>
  > => {
    try {
      const { data, error, response } = await client().PUT('/key-notes/{id}', {
        params: { path: { id } },
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(KeyNoteSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: PUT /key-notes/{id} failed')
      return fail('unknown')
    }
  },
}
