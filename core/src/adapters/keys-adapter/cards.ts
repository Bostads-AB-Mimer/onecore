import { logger } from '@onecore/utilities'
import { client, mapFetchError, ok, fail } from './helpers'
import { Card, CardDetails, CommonErr, AdapterResult } from './types'

export const CardsApi = {
  getById: async (
    cardId: string
  ): Promise<AdapterResult<Card, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/cards/{cardId}', {
        params: { path: { cardId } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.content as Card)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /cards/{cardId} failed')
      return fail('unknown')
    }
  },

  getByRentalObjectCode: async (
    rentalObjectCode: string,
    options?: {
      includeLoans?: boolean
    }
  ): Promise<AdapterResult<CardDetails[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/cards/by-rental-object/{rentalObjectCode}',
        {
          params: {
            path: { rentalObjectCode },
            query: { includeLoans: options?.includeLoans },
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.content as CardDetails[])
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /cards/by-rental-object failed'
      )
      return fail('unknown')
    }
  },
}
