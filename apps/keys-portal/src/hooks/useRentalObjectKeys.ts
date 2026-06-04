import { useEffect, useState } from 'react'

import type { KeyDetails, CardDetails } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { cardService } from '@/services/api/cardService'

/**
 * Loads the keys and cards for a rental object (with loans/events/keySystem) and
 * exposes a `refreshStatuses` to re-fetch after a loan/return/dispose. Re-fetches on
 * mount, on object change, and whenever `refreshTrigger` increments.
 */
export function useRentalObjectKeys(
  rentalPropertyId: string,
  refreshTrigger?: number
) {
  const [keys, setKeys] = useState<KeyDetails[]>([])
  const [cards, setCards] = useState<CardDetails[]>([])
  const [loading, setLoading] = useState(true)

  const fetchKeysAndCards = async () => {
    const [fetchedKeys, fetchedCards] = await Promise.all([
      keyService.getKeysByRentalObjectCode(rentalPropertyId, {
        includeLoans: true,
        includeEvents: true,
        includeKeySystem: true,
      }),
      cardService.getCardsByRentalObjectCode(rentalPropertyId, {
        includeLoans: true,
      }),
    ])
    return { fetchedKeys, fetchedCards }
  }

  const refreshStatuses = async () => {
    const { fetchedKeys, fetchedCards } = await fetchKeysAndCards()
    setKeys(fetchedKeys)
    setCards(fetchedCards)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { fetchedKeys, fetchedCards } = await fetchKeysAndCards()
        if (!cancelled) {
          setKeys(fetchedKeys)
          setCards(fetchedCards)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalPropertyId])

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refreshStatuses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  return { keys, cards, loading, refreshStatuses }
}
