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
    // For testing: prompt for email if tenant email is missing or redacted
    let recipientEmail = primaryTenant.emailAddress
    if (
      !recipientEmail ||
      recipientEmail.includes('redacted') ||
      recipientEmail.includes('example')
    ) {
      recipientEmail =
        window.prompt(
          'Tenant email is missing. Enter email for testing:',
          ''
        ) || primaryTenant.emailAddress
    }

    // Use fullName if firstName or lastName is missing
    const recipientName =
      primaryTenant.firstName && primaryTenant.lastName
        ? `${primaryTenant.firstName} ${primaryTenant.lastName}`
        : primaryTenant.fullName || 'Tenant'

    await simpleSignService.sendForSignature({
      resourceType: 'receipt',
      resourceId: loanReceipt.id,
      recipientEmail: recipientEmail,
      recipientName: recipientName,
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
export async function getSignatureStatus(receiptId: string): Promise<{
  hasPendingSignature: boolean
  statusText?: string
  statusVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
  signature?: any
}> {
  try {
    const signature = await simpleSignService.getLatestForResource(
      'receipt',
      receiptId
    )

    if (!signature) {
      return { hasPendingSignature: false }
    }

    // Map signature status to display information
    switch (signature.status) {
      case 'sent':
        return {
          hasPendingSignature: true,
          statusText: 'Väntar på signering',
          statusVariant: 'default',
          signature,
        }
      case 'signed':
        return {
          hasPendingSignature: false,
          statusText: 'Signerad',
          statusVariant: 'secondary',
          signature,
        }
      case 'rejected':
        return {
          hasPendingSignature: false,
          statusText: 'Nekad',
          statusVariant: 'destructive',
          signature,
        }
      case 'superseded':
        return {
          hasPendingSignature: false,
          statusText: 'Ersatt',
          statusVariant: 'outline',
          signature,
        }
      default:
        return {
          hasPendingSignature: false,
          statusText: signature.status,
          statusVariant: 'outline',
          signature,
        }
    }
  } catch (err) {
    console.error('Failed to fetch signature status:', err)
    return { hasPendingSignature: false }
  }
}

/**
 * Manually sync signature status from SimpleSign
 */
export async function handleSyncSignatureStatus(
  receiptId: string,
  onSuccess?: () => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the latest signature for this receipt
    const signature = await simpleSignService.getLatestForResource(
      'receipt',
      receiptId
    )

    if (!signature) {
      return {
        success: false,
        error: 'Ingen signaturförfrågan hittades',
      }
    }

    // Sync status from SimpleSign
    await simpleSignService.syncSignature(signature.id)

    // Call success callback (e.g., refresh data)
    if (onSuccess) {
      await onSuccess()
    }

    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? 'Kunde inte synkronisera signaturstatus',
    }
  }
}
