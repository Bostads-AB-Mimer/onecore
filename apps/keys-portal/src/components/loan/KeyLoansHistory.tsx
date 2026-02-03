import { useState, useEffect } from 'react'
import { KeyRound, Clock } from 'lucide-react'

import type { Lease } from '@/services/types'
import { LoanCard } from '@/components/shared/LoanCard'
import { useKeyLoans } from '@/hooks/useKeyLoans'
import { keyService } from '@/services/api/keyService'

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

  // Fetch active loans
  const {
    keyLoans: activeLoans,
    loading: loadingActive,
    refresh: refreshActive,
  } = useKeyLoans(lease, false, true)

  // Fetch returned loans
  const {
    keyLoans: returnedLoans,
    loading: loadingReturned,
    refresh: refreshReturned,
  } = useKeyLoans(lease, true, true)

  // Refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refreshActive()
      refreshReturned()
    }
  }, [refreshKey, refreshActive, refreshReturned])

  // Build key system map when loans change
  useEffect(() => {
    const buildKeySystemMap = async () => {
      const allLoans = [...activeLoans, ...returnedLoans]
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
  }, [activeLoans, returnedLoans])

  const handleRefresh = () => {
    refreshActive()
    refreshReturned()
    onReceiptUploaded?.()
  }

  const isLoading = loadingActive || loadingReturned
  const hasNoLoans = activeLoans.length === 0 && returnedLoans.length === 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Laddar lånhistorik...
      </div>
    )
  }

  if (hasNoLoans) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Ingen lånhistorik</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active loans section */}
      {activeLoans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            Aktiva lån ({activeLoans.length})
          </h3>
          <div className="space-y-2">
            {activeLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                keySystemMap={loansKeySystemMap}
                lease={lease}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        </div>
      )}

      {/* Returned loans section */}
      {returnedLoans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            Återlämnade lån ({returnedLoans.length})
          </h3>
          <div className="space-y-2">
            {returnedLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                keySystemMap={loansKeySystemMap}
                lease={lease}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
