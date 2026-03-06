import { logger } from '@onecore/utilities'
import { client, mapFetchError, ok, fail } from './helpers'
import { CardOwner, Card, CommonErr, AdapterResult } from './types'

export const DaxApi = {
  searchCardOwners: async (
    query: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<CardOwner[], CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/dax/card-owners', {
        params: { query: query as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.cardOwners as CardOwner[])
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /dax/card-owners failed')
      return fail('unknown')
    }
  },

  getCardOwner: async (
    cardOwnerId: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<CardOwner, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/dax/card-owners/{cardOwnerId}',
        {
          params: {
            path: { cardOwnerId },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.cardOwner as CardOwner)
    } catch (e) {
      logger.error(
        { err: e },
        'keys-adapter: GET /dax/card-owners/{cardOwnerId} failed'
      )
      return fail('unknown')
    }
  },

  getCard: async (
    cardId: string,
    query?: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<Card, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET(
        '/dax/cards/{cardId}',
        {
          params: {
            path: { cardId },
            query: query as any,
          },
        }
      )
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(data.card as Card)
    } catch (e) {
      logger.error({ err: e }, 'keys-adapter: GET /dax/cards/{cardId} failed')
      return fail('unknown')
    }
  },
}
