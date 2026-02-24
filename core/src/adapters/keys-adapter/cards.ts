import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail } from './helpers'
import {
  Card,
  CardDetails,
  CardSchema,
  CardDetailsSchema,
  CommonErr,
  AdapterResult,
} from './types'

export const CardsApi = {
  getById: async (
    cardId: string
  ): Promise<AdapterResult<Card, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/cards/{cardId}', {
        params: { path: { cardId } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(CardSchema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /cards/{cardId} failed')
      return fail('unknown')
    }
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<CardDetails[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/cards/by-rental-object/{rentalObjectCode}',
        {
          params: {
            path: { rentalObjectCode },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(z.array(CardDetailsSchema).parse(data.content))
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /cards/by-rental-object failed'
      )
      return fail('unknown')
    }
  },
}
