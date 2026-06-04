/**
 * Receipt persistence — the single vocabulary for receipt rows and their PDF files.
 *
 * Replaces the three interchangeable patterns used across the old flow (create /
 * createWithFile / create+uploadFile) and the hand-rolled `new File(...)` blobs, so
 * every call site creates and attaches receipts the same way.
 */
import { receiptService } from '../api/receiptService'
import type { Receipt } from '../types'

type ReceiptType = 'LOAN' | 'RETURN'

/** Creates an empty PHYSICAL receipt row of the given type for a loan. */
export async function createPendingReceipt(
  keyLoanId: string,
  receiptType: ReceiptType
): Promise<Receipt> {
  return receiptService.create({ keyLoanId, receiptType, type: 'PHYSICAL' })
}

/**
 * Wraps a PDF blob in a File and uploads it to an existing receipt row, returning
 * the stored fileId. `namePrefix` only affects the stored filename.
 */
export async function attachPdf(
  receiptId: string,
  blob: Blob,
  namePrefix = 'receipt'
): Promise<string> {
  const file = new File([blob], `${namePrefix}_${receiptId}.pdf`, {
    type: 'application/pdf',
  })
  const { fileId } = await receiptService.uploadFile(receiptId, file)
  return fileId
}

/** Creates a receipt row and attaches its PDF in one step (row first, then file). */
export async function createReceiptWithPdf(
  keyLoanId: string,
  receiptType: ReceiptType,
  blob: Blob,
  namePrefix?: string
): Promise<Receipt> {
  const receipt = await createPendingReceipt(keyLoanId, receiptType)
  const fileId = await attachPdf(receipt.id, blob, namePrefix)
  return { ...receipt, fileId }
}
