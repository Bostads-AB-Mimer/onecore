import { useState, useEffect, useCallback } from 'react'

import type { Lease, KeyLoanWithDetails } from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'

export interface UseKeyLoansResult {
  keyLoans: KeyLoanWithDetails[]
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Hook for fetching and managing key loans for a lease
 * Uses optimized endpoint that fetches loans with keys and receipts in a single query
 * Auto-creates missing receipts for active loans
 *
 * @param lease - The lease to fetch key loans for
 * @param returned - Filter by return status: true = returned loans, false = active loans, undefined = all
 * @param enabled - Whether to fetch data (default: true). Set to false for lazy loading.
 * @returns Key loan data, loading state, and refresh function
 */
export function useKeyLoans(
  lease: Lease,
  returned?: boolean,
  enabled = true
): UseKeyLoansResult {
  const [keyLoans, setKeyLoans] = useState<KeyLoanWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  const fetchKeyLoans = useCallback(async () => {
    if (!enabled) {
      // Don't clear data when disabled, just skip fetching
      // This preserves the count when section is collapsed
      return
    }

    setLoading(true)
    try {
      const contacts =
        lease.tenants?.map((t) => t.contactCode).filter(Boolean) || []

      const allLoansWithDetails = await keyLoanService.getByRentalObject(
        lease.rentalPropertyId,
        contacts[0],
        contacts[1],
        true, // Include receipts - receipts already included in response
        returned // Filter by returned status
      )

      // Auto-create missing receipts for active loans only (skip for returned loans)
      // We already have receipts info from the response above
      const enriched: KeyLoanWithDetails[] = []

      for (const loan of allLoansWithDetails) {
        const isActive = !loan.returnedAt
        const receipts = loan.receipts || []
        const hasLoanReceipt = receipts.some((r) => r.receiptType === 'LOAN')

        // Only auto-create for active loans that are missing LOAN receipts
        // Skip for returned loans (historical data)
        if (returned === false && isActive && !hasLoanReceipt) {
          try {
            console.log('Auto-creating missing receipt for loan:', loan.id)
            const newReceipt = await receiptService.create({
              keyLoanId: loan.id,
              receiptType: 'LOAN',
              type: 'PHYSICAL',
            })
            enriched.push({
              ...loan,
              receipts: [...receipts, newReceipt],
            })
          } catch (err) {
            console.error(
              'Failed to auto-create receipt for loan:',
              loan.id,
              err
            )
            // Keep the loan even if receipt creation fails
            enriched.push(loan)
          }
        } else {
          // No auto-creation needed, use loan as-is with existing receipts
          enriched.push(loan)
        }
      }

      setKeyLoans(enriched)
    } catch (err) {
      console.error('Failed to fetch key loans:', err)
    } finally {
      setLoading(false)
    }
  }, [lease.rentalPropertyId, lease.tenants, returned, enabled])

  useEffect(() => {
    fetchKeyLoans()
  }, [fetchKeyLoans])

  return {
    keyLoans,
    loading,
    refresh: fetchKeyLoans,
  }
}
