import {
  generateMaintenanceLoanReceiptBlob,
  generateMaintenanceReturnReceiptBlob,
} from '@/lib/pdf-receipts'

import { maintenanceKeysService } from './api/maintenanceKeysService'
import { receiptService } from './api/receiptService'
import { keyService } from './api/keyService'
import type { MaintenanceReceiptData, Key } from './types'

/**
 * Fetch all data needed to generate a maintenance key receipt
 * @param loanId - Maintenance key loan ID
 * @returns Receipt data including company, contact person, and keys
 */
export async function fetchMaintenanceReceiptData(
  loanId: string
): Promise<MaintenanceReceiptData> {
  // Fetch the maintenance loan
  const loan = await maintenanceKeysService.get(loanId)

  // Parse the keys JSON field to get key IDs
  let keyIds: string[] = []
  try {
    keyIds = JSON.parse(loan.keys)
  } catch (error) {
    console.error('Failed to parse keys from maintenance loan:', error)
    throw new Error('Invalid keys data in maintenance loan')
  }

  // Fetch each key by ID
  const keysArray: Key[] = await Promise.all(
    keyIds.map((keyId) => keyService.getKey(keyId))
  )

  return {
    company: loan.company || 'Unknown',
    contactPerson: loan.contactPerson,
    keys: keysArray,
    receiptType: loan.returnedAt ? 'RETURN' : 'LOAN',
    operationDate: loan.returnedAt ? new Date(loan.returnedAt) : new Date(),
  }
}

/**
 * Generate and open a maintenance loan receipt in a new tab for printing
 * @param loanId - Maintenance key loan ID
 */
export async function generateAndOpenMaintenanceLoanReceipt(
  loanId: string
): Promise<void> {
  const data = await fetchMaintenanceReceiptData(loanId)
  const { blob } = await generateMaintenanceLoanReceiptBlob(data)

  // Open the PDF in a new tab with print dialog
  const pdfUrl = URL.createObjectURL(blob)
  const win = window.open(pdfUrl, '_blank')
  if (win) {
    // Trigger print after a short delay
    setTimeout(() => {
      try {
        win.print()
      } catch (e) {
        console.error('Failed to trigger print:', e)
      }
    }, 400)

    // Cleanup URL after 5 minutes
    setTimeout(
      () => {
        URL.revokeObjectURL(pdfUrl)
      },
      5 * 60 * 1000
    )
  }
}

/**
 * Generate a maintenance return receipt and upload it to MinIO
 * @param loanId - Maintenance key loan ID
 * @param receiptId - Receipt ID for the return receipt
 */
export async function generateAndUploadMaintenanceReturnReceipt(
  loanId: string,
  receiptId: string
): Promise<void> {
  const data = await fetchMaintenanceReceiptData(loanId)
  const { blob, fileName } = await generateMaintenanceReturnReceiptBlob(
    data,
    receiptId
  )

  // Convert blob to File for upload
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // Upload to MinIO
  await receiptService.uploadFile(receiptId, file)
}
