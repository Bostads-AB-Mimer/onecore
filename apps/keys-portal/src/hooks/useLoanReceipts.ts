import { useEffect, useState } from 'react'

import type { KeyLoan, KeyLoanWithDetails, Receipt } from '@/services/types'
import { receiptService } from '@/services/api/receiptService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { useEditKeyLoanHandlers } from '@/hooks/useEditKeyLoanHandlers'

function isEnriched(
  loan: KeyLoan | KeyLoanWithDetails
): loan is KeyLoanWithDetails {
  return 'keysArray' in loan && loan.keysArray !== undefined
}

type ReceiptRef = Pick<Receipt, 'id' | 'fileId'> | null

/**
 * Loads a loan's LOAN/RETURN receipts and enriches the loan, lazily (only once
 * `enabled` — e.g. the action menu has been opened). Also exposes the validated
 * upload used to attach a signed loan receipt.
 */
export function useLoanReceipts(
  loan: KeyLoan | KeyLoanWithDetails,
  enabled: boolean,
  onRefresh?: () => void
) {
  const [enrichedLoan, setEnrichedLoan] = useState<KeyLoanWithDetails | null>(
    isEnriched(loan) ? loan : null
  )
  const [loanReceipt, setLoanReceipt] = useState<ReceiptRef>(null)
  const [returnReceipt, setReturnReceipt] = useState<ReceiptRef>(null)

  useEffect(() => {
    if (isEnriched(loan)) setEnrichedLoan(loan)
  }, [loan])

  const reloadReceipts = async () => {
    const receipts = await receiptService.getByKeyLoan(loan.id)
    setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') ?? null)
    setReturnReceipt(receipts.find((r) => r.receiptType === 'RETURN') ?? null)
  }

  useEffect(() => {
    if (!enabled) return
    reloadReceipts().catch((e) => console.error('Failed to load receipts:', e))
    if (!isEnriched(loan)) {
      keyLoanService
        .get(loan.id, { includeKeySystem: true, includeCards: true })
        .then((d) => setEnrichedLoan(d as KeyLoanWithDetails))
        .catch((e) => console.error('Failed to enrich loan:', e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loan.id])

  const { handleReceiptUpload, validateFile } = useEditKeyLoanHandlers({
    onSuccess: async () => {
      await reloadReceipts()
      onRefresh?.()
    },
  })

  const uploadReceipt = (file: File) => handleReceiptUpload(loan.id, file)

  const downloadReceipt = (receiptId: string) =>
    receiptService.downloadFile(receiptId)

  return {
    enrichedLoan,
    loanReceipt,
    returnReceipt,
    reloadReceipts,
    uploadReceipt,
    validateFile,
    downloadReceipt,
  }
}
