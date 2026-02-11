import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

import type { Lease, CardDetails } from '@/services/types'
import { KeyLoansExpandableTable } from './KeyLoansExpandableTable'
import { useKeyLoans } from '@/hooks/useKeyLoans'
import { keyService } from '@/services/api/keyService'
import { cardService } from '@/services/api/cardService'

interface KeyLoansHistoryProps {
  lease: Lease
  refreshKey?: number
  onReceiptUploaded?: () => void
}

export function KeyLoansHistory({
  lease,
  refreshKey,
  onReceiptUploaded,
}: KeyLoansHistoryProps) {
  const [loansKeySystemMap, setLoansKeySystemMap] = useState<
    Record<string, string>
  >({})
  const [cardDetailsMap, setCardDetailsMap] = useState<
    Record<string, CardDetails>
  >({})

  // Fetch all loans (both active and returned)
  const {
    keyLoans: allLoans,
    loading,
    refresh,
  } = useKeyLoans(lease, undefined, true)

  // Refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refresh()
    }
  }, [refreshKey, refresh])

  // Fetch full card details for owner links and codes
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const cards = await cardService.getCardsByRentalObjectCode(
          lease.rentalPropertyId
        )
        const map: Record<string, CardDetails> = {}
        for (const card of cards) {
          map[card.cardId] = card
        }
        setCardDetailsMap(map)
      } catch (error) {
        console.error('Failed to fetch card details:', error)
      }
    }
    fetchCards()
  }, [lease.rentalPropertyId])

  // Build key system map when loans change
  useEffect(() => {
    const buildKeySystemMap = async () => {
      const allKeys = allLoans.flatMap((loan) => loan.keysArray)
      const uniqueKeySystemIds = [
        ...new Set(
          allKeys
            .map((k) => k.keySystemId)
            .filter((id): id is string => id != null && id !== '')
        ),
      ]

      if (uniqueKeySystemIds.length > 0) {
        const systemMap: Record<string, string> = {}
        await Promise.all(
          uniqueKeySystemIds.map(async (id) => {
            try {
              const keySystem = await keyService.getKeySystem(id)
              systemMap[id] = keySystem.systemCode
            } catch (error) {
              console.error(`Failed to fetch key system ${id}:`, error)
            }
          })
        )
        setLoansKeySystemMap(systemMap)
      }
    }

    buildKeySystemMap()
  }, [allLoans])

  const handleRefresh = () => {
    refresh()
    onReceiptUploaded?.()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Laddar lånhistorik...
      </div>
    )
  }

  return (
    <KeyLoansExpandableTable
      loans={allLoans}
      keySystemMap={loansKeySystemMap}
      cardDetailsMap={cardDetailsMap}
      lease={lease}
      emptyMessage="Ingen lånhistorik"
      onLoanUpdated={handleRefresh}
      onLoanReturned={handleRefresh}
    />
  )
}
