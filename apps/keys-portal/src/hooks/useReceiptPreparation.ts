import { useEffect, useState } from 'react'

import { mergeComment, prepareReceipt } from '@/services/loans/receiptData'
import type { LoanObjectOption } from '@/services/loans/receiptResolution'
import type { ReceiptData } from '@/services/types'

/**
 * Owns a loan receipt's preparation for the print dialog: the single loan fetch, the
 * object → Avtal pick state machine, and building the final print payload. Serves
 * tenant and maintenance loans alike — maintenance carries no object options, so the
 * pickers stay hidden. Re-fetches only when the receipt/loan id changes.
 */
export function useReceiptPreparation({
  isOpen,
  receiptId,
  loanId,
}: {
  isOpen: boolean
  receiptId?: string | null
  loanId?: string | null
}) {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [objectOptions, setObjectOptions] = useState<LoanObjectOption[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [leaseDisplayId, setLeaseDisplayId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || (!receiptId && !loanId)) {
      setReceiptData(null)
      setObjectOptions([])
      setSelectedObjectId('')
      setLeaseDisplayId('')
      setError(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { receiptData: data, objectOptions: options } =
          await prepareReceipt({ receiptId, loanId })
        if (cancelled) return
        setReceiptData(data)
        setObjectOptions(options)
        // Auto-select a single object and, if unambiguous, its single lease.
        const only = options.length === 1 ? options[0] : undefined
        setSelectedObjectId(only?.rentalPropertyId ?? '')
        setLeaseDisplayId(
          only?.matches.length === 1 ? only.matches[0].leaseId : ''
        )
      } catch (err) {
        if (cancelled) return
        setReceiptData(null)
        setError(
          err instanceof Error
            ? err.message
            : 'Kunde inte skapa kvittensen. Kontrollera lånets kontakt.'
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [isOpen, receiptId, loanId])

  const selectedObject = objectOptions.find(
    (o) => o.rentalPropertyId === selectedObjectId
  )
  const leaseMatches = selectedObject?.matches ?? []
  const needsObjectPick = objectOptions.length > 1 && !selectedObject
  const needsLeasePick =
    leaseMatches.length > 1 &&
    !leaseMatches.some((l) => l.leaseId === leaseDisplayId)

  // Picking an object resets the lease to its sole match (or blank).
  const selectObject = (id: string) => {
    setSelectedObjectId(id)
    const obj = objectOptions.find((o) => o.rentalPropertyId === id)
    setLeaseDisplayId(obj?.matches.length === 1 ? obj.matches[0].leaseId : '')
  }

  /** The prepared data with the chosen Avtal and the signed comment merged in. */
  const getPrintData = (comment: string): ReceiptData | null =>
    receiptData && {
      ...receiptData,
      rentalPropertyId: selectedObject?.rentalPropertyId,
      address: selectedObject?.address ?? null,
      leaseDisplayId: leaseDisplayId.trim() || undefined,
      comment: mergeComment(receiptData.comment, comment),
    }

  return {
    receiptData,
    isLoading,
    error,
    canPrint:
      !!receiptData &&
      !isLoading &&
      !error &&
      !needsObjectPick &&
      !needsLeasePick,
    contract: {
      objectOptions,
      selectedObjectId,
      selectObject,
      leaseMatches,
      leaseDisplayId,
      setLeaseDisplayId,
    },
    getPrintData,
  }
}
