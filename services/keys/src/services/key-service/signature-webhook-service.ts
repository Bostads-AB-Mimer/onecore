/**
 * Business logic service for processing SimpleSign webhooks
 *
 * This service handles the complex multi-step transaction when a signature is completed:
 * 1. Update signature status
 * 2. Download signed PDF from SimpleSign
 * 3. Upload to MinIO
 * 4. Update receipt with fileId
 * 5. Supersede other pending signatures for same resource
 *
 * All operations are wrapped in a transaction to ensure data consistency.
 */

import { Knex } from 'knex'
import * as signaturesAdapter from './adapters/signatures-adapter'
import * as receiptsAdapter from './adapters/receipts-adapter'
import * as simpleSignApi from './adapters/simplesign-adapter'
import { uploadFile } from './adapters/minio'
import { logger } from '@onecore/utilities'

export interface ProcessWebhookParams {
  documentId: number
  status: string
  statusUpdatedAt: string
}

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; err: E }

/**
 * Process SimpleSign webhook and update signature + receipt
 *
 * This function coordinates multiple operations in a transaction:
 * - Updates signature status
 * - Downloads signed PDF if status is 'signed'
 * - Uploads PDF to MinIO
 * - Updates receipt with fileId
 * - Supersedes other pending signatures
 *
 * If any step fails, the entire transaction is rolled back.
 *
 * @returns Result indicating success or specific failure point
 */
export async function processSignatureWebhook(
  params: ProcessWebhookParams,
  dbConnection: Knex | Knex.Transaction
): Promise<Result<{ fileId?: string }, string>> {
  try {
    // Find signature by SimpleSign document ID
    const signature =
      await signaturesAdapter.getSignatureBySimpleSignDocumentId(
        params.documentId,
        dbConnection
      )

    if (!signature) {
      return { ok: false, err: 'signature-not-found' }
    }

    // Perform all operations in transaction
    const result = await dbConnection.transaction(async (trx) => {
      // Step 1: Update signature status
      const updateResult = await signaturesAdapter.updateSignatureStatus(
        params.documentId,
        params.status,
        params.status === 'signed'
          ? new Date(params.statusUpdatedAt)
          : undefined,
        trx
      )

      if (!updateResult) {
        throw new Error('update-signature')
      }

      // If not signed, we're done
      if (params.status !== 'signed') {
        return { ok: true, data: {} } as const
      }

      // Step 2: Check if receipt exists and doesn't have fileId
      if (signature.resourceType === 'receipt') {
        const receipt = await receiptsAdapter.getReceiptById(
          signature.resourceId,
          trx
        )

        if (!receipt) {
          throw new Error('receipt-not-found')
        }

        if (receipt.fileId) {
          // Receipt already has a file (race condition), skip processing
          logger.info(
            { receiptId: signature.resourceId },
            'Receipt already has fileId, skipping'
          )
          return { ok: true, data: { fileId: receipt.fileId } } as const
        }

        // Step 3: Download signed PDF from SimpleSign
        let pdfBuffer: Buffer
        try {
          pdfBuffer = await simpleSignApi.downloadSignedPdf(params.documentId)
        } catch (err) {
          logger.error(
            { err, documentId: params.documentId },
            'Failed to download signed PDF from SimpleSign'
          )
          throw new Error('download-pdf')
        }
        // Step 4: Upload to MinIO
        let minioFileId: string
        try {
          minioFileId = await uploadFile(
            pdfBuffer,
            `receipt-${signature.resourceId}-signed.pdf`,
            {
              'Content-Type': 'application/pdf',
              'x-amz-meta-signed': 'true',
              'x-amz-meta-signature-id': signature.id,
            }
          )
        } catch (err) {
          logger.error(
            { err, receiptId: signature.resourceId },
            'Failed to upload signed PDF to MinIO'
          )
          throw new Error('upload-file')
        }
        // Step 5: Update receipt with fileId
        const updatedReceipt = await receiptsAdapter.updateReceipt(
          signature.resourceId,
          { fileId: minioFileId },
          trx
        )

        if (!updatedReceipt) {
          throw new Error('update-receipt')
        }

        // Step 6: Mark other pending signatures as superseded
        const superseded = await signaturesAdapter.supersedePendingSignatures(
          signature.resourceType,
          signature.resourceId,
          signature.id,
          trx
        )

        logger.info(
          {
            receiptId: signature.resourceId,
            fileId: minioFileId,
            supersededCount: superseded,
          },
          'Signed PDF uploaded and receipt updated'
        )

        return { ok: true, data: { fileId: minioFileId } } as const
      }

      return { ok: true, data: {} } as const
    })

    return result
  } catch (err: any) {
    logger.error(err, 'Error processing signature webhook')

    // Map known error messages to specific error codes
    const errorMessage = err.message || 'unknown'
    const knownErrors = [
      'update-signature',
      'receipt-not-found',
      'download-pdf',
      'upload-file',
      'update-receipt',
    ]

    if (knownErrors.includes(errorMessage)) {
      return { ok: false, err: errorMessage }
    }

    return { ok: false, err: 'transaction-failed' }
  }
}
