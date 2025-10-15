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
 * @param preloadedKeys - Optional pre-fetched keys to avoid duplicate fetches
 * @returns Key loan data and control functions
 */
export function useKeyLoans(
  lease: Lease,
  onUnsignedLoansChange?: (hasUnsigned: boolean) => void,
  preloadedKeys?: Key[]
): UseKeyLoansResult {
  const [keyLoans, setKeyLoans] = useState<KeyLoanWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  const fetchKeyLoans = useCallback(async () => {
    setLoading(true)
    try {
      const { loaned, returned } = await keyLoanService.listByLease(
        lease.rentalPropertyId,
        preloadedKeys
      )
      const allKeyLoans = [...loaned, ...returned]

      // Step 1: Collect all unique key IDs across all loans
      const allUniqueKeyIds = new Set<string>()
      allKeyLoans.forEach((loan) => {
        const keyIds: string[] = JSON.parse(loan.keys || '[]')
        keyIds.forEach((id) => allUniqueKeyIds.add(id))
      })

      // Step 2: Build key cache - use preloaded keys first, then fetch missing ones
      const keyCache = new Map<string, Key>()

      // If we have preloaded keys, use them first to avoid duplicate fetches
      if (preloadedKeys && preloadedKeys.length > 0) {
        preloadedKeys.forEach((key) => keyCache.set(key.id, key))
      }

      // Fetch only the keys that aren't in the cache
      for (const keyId of allUniqueKeyIds) {
        if (!keyCache.has(keyId)) {
          try {
            const key = await keyService.getKey(keyId)
            keyCache.set(keyId, key)
          } catch (err) {
            console.error(`Failed to fetch key ${keyId}:`, err)
          }
        }
      }

      // Step 3: Fetch all receipts in parallel for better performance
      const receiptsArrays = await Promise.all(
        allKeyLoans.map((loan) =>
          receiptService.getByKeyLoan(loan.id).catch((err) => {
            console.error(`Failed to fetch receipts for loan ${loan.id}:`, err)
            return []
          })
        )
      )

      // Step 4: Enrich each loan with keys and receipts, auto-creating if needed
      const enriched: KeyLoanWithDetails[] = []
      for (let i = 0; i < allKeyLoans.length; i++) {
        const keyLoan = allKeyLoans[i]
        let receipts = receiptsArrays[i]

        try {
          const keyIds: string[] = JSON.parse(keyLoan.keys || '[]')

          // Get keys from cache (no network calls)
          const keys: Key[] = keyIds
            .map((id) => keyCache.get(id))
            .filter((key): key is Key => key !== undefined)

          let loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
          const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

          // Auto-create missing receipt for active loans
          if (!keyLoan.returnedAt && !loanReceipt) {
            try {
              console.log('Auto-creating missing receipt for loan:', keyLoan.id)
              loanReceipt = await receiptService.create({
                keyLoanId: keyLoan.id,
                receiptType: 'LOAN',
                type: 'PHYSICAL',
              })
              receipts = [...receipts, loanReceipt]
            } catch (err) {
              console.error(
                'Failed to auto-create receipt for loan:',
                keyLoan.id,
                err
              )
            }
          }

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
    // Note: preloadedKeys is intentionally excluded from dependencies to prevent
    // re-fetching when the array reference changes (React creates new array refs on each render).
    // The callback will still use the latest preloadedKeys value when it runs.
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
