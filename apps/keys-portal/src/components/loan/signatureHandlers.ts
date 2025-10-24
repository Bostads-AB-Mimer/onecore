import type {
  KeyLoan,
  Key,
  Lease,
  ReceiptData,
  Receipt,
} from '@/services/types'
import { receiptService } from '@/services/api/receiptService'
import { simpleSignService } from '@/services/api/simpleSignService'
import { generateLoanReceiptBlob } from '@/lib/pdf-receipts'

export interface SignatureHandlerParams {
  loanReceipt: Receipt
  lease: Lease
  keys: Key[]
  keyLoan: KeyLoan
  onSuccess?: () => Promise<void>
}

export interface SignatureHandlerResult {
  success: boolean
  error?: string
}

/**
 * Handles sending a receipt for digital signature via SimpleSign
 */
export async function handleSendForDigitalSignature({
  loanReceipt,
  lease,
  keys,
  keyLoan,
  onSuccess,
}: SignatureHandlerParams): Promise<SignatureHandlerResult> {
  try {
    // Get the primary tenant's email
    const primaryTenant = lease.tenants?.[0]
    if (!primaryTenant?.emailAddress) {
      return {
        success: false,
        error: 'Ingen e-postadress hittades för hyresgästen',
      }
    }

    // Generate the PDF blob
    const receiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys,
      receiptType: 'LOAN',
      operationDate: keyLoan.createdAt
        ? new Date(keyLoan.createdAt)
        : new Date(),
    }

    const { blob } = await generateLoanReceiptBlob(receiptData, loanReceipt.id)

    // Convert blob to base64
    const base64 = await receiptService.blobToBase64(blob)

    // Send to SimpleSign
    // TODO: Temporary hardcoded email for testing (original: primaryTenant.emailAddress)
    await simpleSignService.sendForSignature({
      resourceType: 'receipt',
      resourceId: loanReceipt.id,
      recipientEmail: '', // primaryTenant.emailAddress,
      recipientName: `${primaryTenant.firstName} ${primaryTenant.lastName}`,
      pdfBase64: base64,
    })

    // Call success callback (e.g., refresh data)
    if (onSuccess) {
      await onSuccess()
    }

    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? 'Kunde inte skicka för digital signering',
    }
  }
}

/**
 * Get signature status display information
 */
export function getSignatureStatus(receipt: Receipt): {
  hasPendingSignature: boolean
  statusText?: string
  statusVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
} {
  // TODO: Fetch signature status from API when needed
  // For now, we'll rely on whether receipt has a fileId
  return {
    hasPendingSignature: false,
  }
}
