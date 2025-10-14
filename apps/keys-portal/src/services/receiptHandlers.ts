import { receiptService } from './api/receiptService'
import { keyLoanService } from './api/keyLoanService'
import { keyService } from './api/keyService'
import { openPdfInNewTab } from '@/lib/receiptPdfUtils'
import type { ReceiptData, Lease } from './types'

/**
 * Fetches all data needed for a receipt and constructs ReceiptData
 * @param receiptId - The receipt ID
 * @param lease - The lease associated with the receipt
 * @returns ReceiptData ready for PDF generation
 */
export async function fetchReceiptData(
  receiptId: string,
  lease: Lease
): Promise<ReceiptData> {
  // Get the receipt
  const receipt = await receiptService.getById(receiptId)
  console.log(
    'fetchReceiptData - receiptId:',
    receiptId,
    'receiptType:',
    receipt.receiptType
  )

  // Get the key loan from the receipt
  const keyLoan = await keyLoanService.get(receipt.keyLoanId)

  // Parse key IDs from the loan
  let keyIds: string[] = []
  try {
    keyIds = JSON.parse(keyLoan.keys || '[]')
  } catch {
    // Fallback to comma-separated if not JSON
    keyIds = keyLoan.keys ? keyLoan.keys.split(',').map((id) => id.trim()) : []
  }

  // Fetch all keys
  const keys = await Promise.all(
    keyIds.map((keyId) => keyService.getKey(keyId))
  )

  // Determine operation date based on receipt type
  const operationDate =
    receipt.receiptType === 'LOAN'
      ? keyLoan.createdAt
        ? new Date(keyLoan.createdAt)
        : new Date()
      : keyLoan.returnedAt
        ? new Date(keyLoan.returnedAt)
        : new Date()

  // Construct ReceiptData
  return {
    lease,
    tenants: lease.tenants ?? [],
    keys,
    receiptType: receipt.receiptType,
    operationDate,
  }
}

/**
 * Generates and opens a receipt PDF in a new tab
 * @param receiptId - The receipt ID
 * @param lease - The lease associated with the receipt
 */
export async function generateAndOpenReceipt(
  receiptId: string,
  lease: Lease
): Promise<void> {
  const receiptData = await fetchReceiptData(receiptId, lease)
  await openPdfInNewTab(receiptData, receiptId)
}
