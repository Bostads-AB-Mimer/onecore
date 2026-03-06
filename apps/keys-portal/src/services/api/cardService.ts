import type { Card, CardDetails } from '@/services/types'

import { GET } from './core/base-api'

export const cardService = {
  /**
   * Get a card by ID
   */
  async getCard(cardId: string): Promise<Card | null> {
    const { data, error } = await GET('/cards/{cardId}', {
      params: {
        path: { cardId },
      },
    })

    if (error) throw error
    return (data?.content ?? null) as Card | null
  },

  /**
   * Get cards by rental object code with optional loan enrichment
   */
  async getCardsByRentalObjectCode(
    rentalObjectCode: string,
    options?: {
      includeLoans?: boolean
    }
  ): Promise<CardDetails[]> {
    const queryParams: Record<string, boolean> = {}
    if (options?.includeLoans) queryParams.includeLoans = true

    const { data, error } = await GET(
      '/cards/by-rental-object/{rentalObjectCode}',
      {
        params: {
          path: { rentalObjectCode },
          query: queryParams,
        },
      }
    )

    if (error) throw error
    return (data?.content ?? []) as CardDetails[]
  },
}
