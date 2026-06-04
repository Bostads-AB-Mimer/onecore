import { useEffect, useState } from 'react'

import type { KeyDetails } from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { useStaleGuard } from '@/hooks/useStaleGuard'

/**
 * Reports which of the given keys already have an active (unreturned) loan, so a
 * loan-out dialog can flag/disable them. Re-checks when the dialog opens or the keys
 * change; a stale guard drops results from a superseded run.
 */
export function useActiveLoanCheck(keys: KeyDetails[], open: boolean) {
  const [loanedKeyIds, setLoanedKeyIds] = useState<Set<string>>(new Set())
  const [isChecking, setIsChecking] = useState(false)
  const checkStale = useStaleGuard()

  useEffect(() => {
    if (!open || keys.length === 0) return
    const isStale = checkStale()

    const check = async () => {
      setIsChecking(true)
      const loaned = new Set<string>()
      await Promise.all(
        keys.map(async (key) => {
          try {
            const loans = await keyLoanService.getByKeyId(key.id)
            if (loans.some((l) => !l.returnedAt)) loaned.add(key.id)
          } catch {
            // Ignore — allow an optimistic loan attempt if the check fails.
          }
        })
      )
      if (isStale()) return
      setLoanedKeyIds(loaned)
      setIsChecking(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keys])

  return { loanedKeyIds, isChecking }
}
