import { useState, useEffect, useCallback } from 'react'

import type { Lease, KeyLoan, Key, Receipt } from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
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
 * Handles enriching loan data with keys and receipts,
 * auto-creating missing receipts, and sorting loans by status
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
      const { loaned, returned } = await keyLoanService.listByLease(
        lease.rentalPropertyId
      )
      const allKeyLoans = [...loaned, ...returned]

      const enriched: KeyLoanWithDetails[] = []
      for (const keyLoan of allKeyLoans) {
        try {
          const keyIds: string[] = JSON.parse(keyLoan.keys || '[]')

          // Fetch all keys for this loan
          const keys: Key[] = []
          for (const keyId of keyIds) {
            try {
              const key = await keyService.getKey(keyId)
              keys.push(key)
            } catch (err) {
              console.error(`Failed to fetch key ${keyId}:`, err)
            }
          }

          // Fetch all receipts for this loan
          const receipts = await receiptService.getByKeyLoan(keyLoan.id)
          const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
          const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

          enriched.push({
            keyLoan,
            keys,
            receipts,
            loanReceipt,
            returnReceipt,
          })
        } catch (err) {
          console.error(`Failed to enrich key loan ${keyLoan.id}:`, err)
        }
      }

      // Auto-create missing receipts for active loans
      for (const loanWithDetails of enriched) {
        if (
          !loanWithDetails.keyLoan.returnedAt &&
          !loanWithDetails.loanReceipt
        ) {
          try {
            console.log(
              'Auto-creating missing receipt for loan:',
              loanWithDetails.keyLoan.id
            )
            const receipt = await receiptService.create({
              keyLoanId: loanWithDetails.keyLoan.id,
              receiptType: 'LOAN',
              type: 'PHYSICAL',
            })
            loanWithDetails.loanReceipt = receipt
            loanWithDetails.receipts.push(receipt)
          } catch (err) {
            console.error(
              'Failed to auto-create receipt for loan:',
              loanWithDetails.keyLoan.id,
              err
            )
          }
        }
      }

      // Sort: unsigned active loans first, then signed active loans, then returned loans
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
      const hasUnsignedActiveLoans = enriched.some(
        (loan) =>
          !loan.keyLoan.returnedAt &&
          loan.loanReceipt &&
          !loan.loanReceipt.fileId
      )
      onUnsignedLoansChange?.(hasUnsignedActiveLoans)
    } catch (err) {
      console.error('Failed to fetch key loans:', err)
    } finally {
      setLoading(false)
    }
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
