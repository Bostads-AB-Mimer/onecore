import { useState, useEffect, useCallback } from 'react'

import type { Lease, KeyLoan, Key, Receipt } from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { receiptService } from '@/services/api/receiptService'

/**
 * Lightweight function to check if a rental object has any unsigned active loan receipts
 * Used for eagerly showing the yellow border indicator without loading full receipt data
 */
export async function checkHasUnsignedActiveLoans(
  rentalObjectCode: string
): Promise<boolean> {
  try {
    const { loaned } = await keyLoanService.listByLease(rentalObjectCode)

    // Check each active loan for unsigned receipts
    for (const loan of loaned) {
      const receipts = await receiptService.getByKeyLoan(loan.id)
      const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

      // If there's a loan receipt without a fileId, it's unsigned
      if (loanReceipt && !loanReceipt.fileId) {
        return true
      }
    }

    return false
  } catch (err) {
    console.error('Failed to check unsigned loans:', err)
    return false
  }
}

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
  fetchReturnedLoansReceipts: () => Promise<void>
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

      // Step 3: Fetch receipts ONLY for active loans initially (lazy-load returned loans)
      const activeReceiptsArrays = await Promise.all(
        loaned.map((loan) =>
          receiptService.getByKeyLoan(loan.id).catch((err) => {
            console.error(`Failed to fetch receipts for loan ${loan.id}:`, err)
            return []
          })
        )
      )

      // Helper function to get keys from cache
      const getKeysFromCache = (loan: KeyLoan): Key[] => {
        try {
          const keyIds: string[] = JSON.parse(loan.keys || '[]')
          return keyIds
            .map((id) => keyCache.get(id))
            .filter((key): key is Key => key !== undefined)
        } catch {
          return []
        }
      }

      // Step 4: Enrich active loans with keys and receipts, auto-creating if needed
      const enrichedActive: KeyLoanWithDetails[] = []
      for (let i = 0; i < loaned.length; i++) {
        const keyLoan = loaned[i]
        let receipts = activeReceiptsArrays[i]

        try {
          const keys = getKeysFromCache(keyLoan)
          let loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
          const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

          // Auto-create missing receipt for active loans
          if (!loanReceipt) {
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

          enrichedActive.push({
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

      // Step 5: Enrich returned loans with keys but WITHOUT receipts (lazy-load later)
      const enrichedReturned: KeyLoanWithDetails[] = returned.map((loan) => ({
        keyLoan: loan,
        keys: getKeysFromCache(loan),
        receipts: [], // Empty initially - will be fetched on demand
        loanReceipt: undefined,
        returnReceipt: undefined,
      }))

      // Combine and sort
      const enriched = [...enrichedActive, ...enrichedReturned]
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
      const hasUnsignedActiveLoans = enrichedActive.some(
        (loan) => loan.loanReceipt && !loan.loanReceipt.fileId
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

  // Lazy-load receipts for returned loans
  const fetchReturnedLoansReceipts = useCallback(async () => {
    const returnedLoans = keyLoans.filter((loan) => loan.keyLoan.returnedAt)

    // Check if receipts already loaded
    const needsReceipts = returnedLoans.some(
      (loan) => loan.receipts.length === 0
    )
    if (!needsReceipts) {
      return // Already loaded
    }

    try {
      // Fetch receipts for all returned loans in parallel
      const receiptsArrays = await Promise.all(
        returnedLoans.map((loanWithDetails) =>
          receiptService
            .getByKeyLoan(loanWithDetails.keyLoan.id)
            .catch((err) => {
              console.error(
                `Failed to fetch receipts for returned loan ${loanWithDetails.keyLoan.id}:`,
                err
              )
              return []
            })
        )
      )

      // Update the keyLoans state with the fetched receipts
      setKeyLoans((prev) =>
        prev.map((loan) => {
          if (!loan.keyLoan.returnedAt) {
            return loan // Keep active loans unchanged
          }

          // Find the index of this returned loan
          const returnedIndex = returnedLoans.findIndex(
            (rl) => rl.keyLoan.id === loan.keyLoan.id
          )

          if (returnedIndex === -1) {
            return loan
          }

          const receipts = receiptsArrays[returnedIndex]
          const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
          const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

          return {
            ...loan,
            receipts,
            loanReceipt,
            returnReceipt,
          }
        })
      )
    } catch (err) {
      console.error('Failed to fetch returned loans receipts:', err)
    }
  }, [keyLoans])

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
    fetchReturnedLoansReceipts,
  }
}
