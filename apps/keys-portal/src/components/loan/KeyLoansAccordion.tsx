import { useState, useEffect } from 'react'
import { KeyRound, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { Lease } from '@/services/types'
import { LoanCard } from '@/components/shared/LoanCard'
import { useKeyLoans } from '@/hooks/useKeyLoans'
import { keyService } from '@/services/api/keyService'

interface KeyLoansAccordionProps {
  lease: Lease
  refreshKey?: number
  onReceiptUploaded?: () => void
}

export function KeyLoansAccordion({
  lease,
  refreshKey,
  onReceiptUploaded,
}: KeyLoansAccordionProps) {
  const [showActiveLoans, setShowActiveLoans] = useState(true) // Default open
  const [showReturnedLoans, setShowReturnedLoans] = useState(false) // Default closed
  const [hasEverOpenedReturned, setHasEverOpenedReturned] = useState(false) // Track if returned loans were ever fetched
  const [loansKeySystemMap, setLoansKeySystemMap] = useState<
    Record<string, string>
  >({})

  // Fetch active loans (enabled by default since section starts open)
  const {
    keyLoans: activeLoans,
    loading: loadingActive,
    refresh: refreshActive,
  } = useKeyLoans(lease, false, showActiveLoans)

  // Lazy load returned loans - only fetch when accordion is expanded
  const {
    keyLoans: returnedLoans,
    loading: loadingReturned,
    refresh: refreshReturned,
  } = useKeyLoans(
    lease,
    true,
    showReturnedLoans // Only enabled when accordion is expanded
  )

  // Track when returned loans are first opened
  useEffect(() => {
    if (showReturnedLoans && !hasEverOpenedReturned) {
      setHasEverOpenedReturned(true)
    }
  }, [showReturnedLoans, hasEverOpenedReturned])

  // Refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      if (showActiveLoans) refreshActive()
      if (showReturnedLoans) refreshReturned()
    }
  }, [
    refreshKey,
    showActiveLoans,
    showReturnedLoans,
    refreshActive,
    refreshReturned,
  ])

  // Build key system map when loans change
  useEffect(() => {
    const buildKeySystemMap = async () => {
      const allLoans = [
        ...(showActiveLoans ? activeLoans : []),
        ...(showReturnedLoans ? returnedLoans : []),
      ]
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
  }, [activeLoans, returnedLoans, showActiveLoans, showReturnedLoans])

  const handleToggleActiveLoans = () => {
    setShowActiveLoans(!showActiveLoans)
  }

  const handleToggleReturnedLoans = () => {
    setShowReturnedLoans(!showReturnedLoans)
  }

  const handleRefresh = () => {
    if (showActiveLoans) refreshActive()
    if (showReturnedLoans) refreshReturned()
    onReceiptUploaded?.()
  }

  return (
    <div className="space-y-3">
      {/* Active loans section - collapsible, defaults to open */}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleToggleActiveLoans}
          className="w-full h-8 text-xs gap-2 justify-start"
        >
          {showActiveLoans ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Aktiva lån ({activeLoans.length})
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Aktiva lån ({activeLoans.length})
            </>
          )}
        </Button>

        {/* Show active loans content when expanded */}
        {showActiveLoans && (
          <div className="mt-2">
            {loadingActive ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Laddar aktiva lån...
              </div>
            ) : activeLoans.length > 0 ? (
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
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Inga aktiva nyckellån</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Returned loans section - collapsible, defaults to closed */}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleToggleReturnedLoans}
          className="w-full h-8 text-xs gap-2 justify-start"
        >
          {showReturnedLoans ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Återlämnade lån{' '}
              {hasEverOpenedReturned ? `(${returnedLoans.length})` : ''}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Återlämnade lån{' '}
              {hasEverOpenedReturned ? `(${returnedLoans.length})` : ''}
            </>
          )}
        </Button>

        {showReturnedLoans && (
          <div className="mt-2">
            {loadingReturned ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Laddar återlämnade lån...
              </div>
            ) : returnedLoans.length > 0 ? (
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
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Inga återlämnade lån</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
