import { useState, useEffect, useCallback } from 'react'

import type { Lease, KeyLoan, Key, Receipt } from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'

export interface KeyLoanWithDetails {
  keyLoan: KeyLoan
  keys: Key[]
  receipts: Receipt[]
  loanReceipt?: Receipt
  returnReceipt?: Receipt
}

export interface UseKeyLoansResult {
  keyLoans: KeyLoanWithDetails[]
  activeLoans: KeyLoanWithDetails[]
  returnedLoans: KeyLoanWithDetails[]
  loading: boolean
  hasUnsignedActiveLoans: boolean
  refresh: () => Promise<void>
}

/**
 * Hook for fetching and managing key loans for a lease
 * Uses optimized endpoint that fetches loans with keys and receipts in a single query
 *
 * @param lease - The lease to fetch key loans for
 * @param onUnsignedLoansChange - Optional callback when unsigned loan status changes
 * @returns Key loan data and control functions
 */
export function useKeyLoans(
  lease: Lease,
  onUnsignedLoansChange?: (hasUnsigned: boolean) => void
): UseKeyLoansResult {
  const [keyLoans, setKeyLoans] = useState<KeyLoanWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  const fetchKeyLoans = useCallback(async () => {
    setLoading(true)
    try {
      // Use optimized endpoint that fetches loans with keys and receipts in one call
      // For active loans, include receipts. For returned loans, we'll lazy-load receipts
      const contacts =
        lease.tenants?.map((t) => t.contactCode).filter(Boolean) || []

      const allLoansWithDetails = await keyLoanService.getByRentalObject(
        lease.rentalPropertyId,
        contacts[0],
        contacts[1],
        true // Include receipts for all loans
      )

      // Transform backend KeyLoanWithDetails to frontend format
      const enriched: KeyLoanWithDetails[] = []

      for (const loanDetails of allLoansWithDetails) {
        const isActive = !loanDetails.returnedAt
        let receipts = loanDetails.receipts || []
        let loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
        const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

        // Auto-create missing receipt for active loans only
        if (isActive && !loanReceipt) {
          try {
            console.log(
              'Auto-creating missing receipt for loan:',
              loanDetails.id
            )
            loanReceipt = await receiptService.create({
              keyLoanId: loanDetails.id,
              receiptType: 'LOAN',
              type: 'PHYSICAL',
            })
            receipts = [...receipts, loanReceipt]
          } catch (err) {
            console.error(
              'Failed to auto-create receipt for loan:',
              loanDetails.id,
              err
            )
          }
        }

        enriched.push({
          keyLoan: loanDetails,
          keys: loanDetails.keysArray || [],
          receipts,
          loanReceipt,
          returnReceipt,
        })
      }

      // Sort loans
      enriched.sort((a, b) => {
        const aIsActive = !a.keyLoan.returnedAt
        const bIsActive = !b.keyLoan.returnedAt
        const aIsUnsigned = a.loanReceipt && !a.loanReceipt.fileId
        const bIsUnsigned = b.loanReceipt && !b.loanReceipt.fileId

        // Active loans before returned loans
        if (aIsActive !== bIsActive) {
          return aIsActive ? -1 : 1
        }

        // Among active loans, unsigned before signed
        if (aIsActive && bIsActive && aIsUnsigned !== bIsUnsigned) {
          return aIsUnsigned ? -1 : 1
        }

        // Sort by creation date (newest first)
        const aDate = a.keyLoan.createdAt
          ? new Date(a.keyLoan.createdAt).getTime()
          : 0
        const bDate = b.keyLoan.createdAt
          ? new Date(b.keyLoan.createdAt).getTime()
          : 0
        return bDate - aDate
      })

      setKeyLoans(enriched)

      // Notify parent of unsigned loan status
      const activeLoans = enriched.filter((loan) => !loan.keyLoan.returnedAt)
      const hasUnsignedActiveLoans = activeLoans.some(
        (loan) => loan.loanReceipt && !loan.loanReceipt.fileId
      )
      onUnsignedLoansChange?.(hasUnsignedActiveLoans)
    } catch (err) {
      console.error('Failed to fetch key loans:', err)
    } finally {
      setLoading(false)
    }
    // Note: lease.tenants is intentionally excluded from dependencies to prevent
    // re-fetching when the array reference changes (React creates new array refs on each render).
    // The callback will still use the latest lease value when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lease.rentalPropertyId, onUnsignedLoansChange])

  useEffect(() => {
    fetchKeyLoans()
  }, [fetchKeyLoans])

  // Separate active and returned loans
  const activeLoans = keyLoans.filter((loan) => !loan.keyLoan.returnedAt)
  const returnedLoans = keyLoans.filter((loan) => loan.keyLoan.returnedAt)

  // Calculate if there are unsigned active loans
  const hasUnsignedActiveLoans = activeLoans.some(
    (loan) => loan.loanReceipt && !loan.loanReceipt.fileId
  )

  return {
    keyLoans,
    activeLoans,
    returnedLoans,
    loading,
    hasUnsignedActiveLoans,
    refresh: fetchKeyLoans,
  }
}
