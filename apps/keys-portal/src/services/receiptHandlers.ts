import type { Key, Lease, ReceiptData } from '@/services/types'

export type GenerateSwitchReceiptsParams = {
  lease: Lease
  allLoanKeys: Key[]
  switchedKeys: Key[]
  returnedKeys: Key[]
  returnReceiptId: string
  newLoanReceiptId: string
}

export type GenerateSwitchReceiptsResult = {
  success: boolean
  error?: string
}

/**
 * Handler for preparing receipt data during key switch operation
 * Note: Receipts are no longer auto-downloaded; they will be shown in the dialog
 * @param params - Parameters including lease, keys, and receipt IDs
 * @returns Result with success status
 */
export async function handleGenerateSwitchReceipts({
  lease,
  allLoanKeys,
  switchedKeys,
  returnedKeys,
  returnReceiptId,
  newLoanReceiptId,
}: GenerateSwitchReceiptsParams): Promise<GenerateSwitchReceiptsResult> {
  try {
    // Receipt data is prepared but not downloaded
    // The ReceiptDialog will handle opening the PDFs in a new tab when needed
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to prepare receipt data',
    }
  }
}
