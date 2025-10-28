import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'
import { logger } from '@onecore/utilities'
import * as simpleSignApi from './simplesign-adapter'
import * as receiptsAdapter from './receipts-adapter'
import { uploadFile } from './minio'

type Signature = keys.v1.Signature
type CreateSignatureRequest = keys.v1.CreateSignatureRequest
type UpdateSignatureRequest = keys.v1.UpdateSignatureRequest

const TABLE = 'signatures'

/**
 * Database adapter functions for signatures.
 * These functions wrap database calls to make them easier to test.
 */

export async function getSignatureById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function getSignatureBySimpleSignDocumentId(
  simpleSignDocumentId: number,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature | undefined> {
  return await dbConnection(TABLE).where({ simpleSignDocumentId }).first()
}

export async function getSignaturesByResourceId(
  resourceType: string,
  resourceId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature[]> {
  return await dbConnection(TABLE)
    .where({ resourceType, resourceId })
    .orderBy('sentAt', 'desc')
}

export async function createSignature(
  signatureData: CreateSignatureRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature> {
  const [row] = await dbConnection(TABLE)
    .insert({
      resourceType: signatureData.resourceType,
      resourceId: signatureData.resourceId,
      simpleSignDocumentId: signatureData.simpleSignDocumentId,
      recipientEmail: signatureData.recipientEmail,
      recipientName: signatureData.recipientName ?? null,
      status: signatureData.status ?? 'sent',
    })
    .returning('*')
  return row
}

export async function updateSignature(
  id: string,
  signatureData: UpdateSignatureRequest,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature | undefined> {
  const [row] = await dbConnection(TABLE)
    .where({ id })
    .update(signatureData)
    .returning('*')

  return row
}

export async function deleteSignature(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE).where({ id }).del()
}

/**
 * Update signature status (commonly used by webhooks)
 */
export async function updateSignatureStatus(
  simpleSignDocumentId: number,
  status: string,
  completedAt?: Date,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature | undefined> {
  const updateData: any = {
    status,
    lastSyncedAt: dbConnection.fn.now(),
  }

  if (completedAt) {
    updateData.completedAt = completedAt
  }

  const [row] = await dbConnection(TABLE)
    .where({ simpleSignDocumentId })
    .update(updateData)
    .returning('*')

  return row
}

/**
 * Mark other pending signatures for the same resource as superseded
 */
export async function supersedePendingSignatures(
  resourceType: string,
  resourceId: string,
  excludeSignatureId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  return await dbConnection(TABLE)
    .where({ resourceType, resourceId, status: 'sent' })
    .whereNot({ id: excludeSignatureId })
    .update({ status: 'superseded', lastSyncedAt: dbConnection.fn.now() })
}

/**
 * Delete old signatures (cleanup function)
 */
export async function deleteOldSignatures(
  statuses: string[],
  olderThanDays: number,
  dbConnection: Knex | Knex.Transaction = db
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  return await dbConnection(TABLE)
    .whereIn('status', statuses)
    .where('sentAt', '<', cutoffDate)
    .del()
}

/**
 * Process a signed document - download PDF, upload to MinIO, update receipt
 * This is shared business logic used by both webhooks and manual sync
 */
export async function processSignedDocument(
  signature: Signature,
  status: string,
  completedAt: Date | undefined,
  dbConnection: Knex | Knex.Transaction
): Promise<void> {
  // Update signature status
  await updateSignatureStatus(
    signature.simpleSignDocumentId,
    status,
    completedAt,
    dbConnection
  )

  // Only process signed documents for receipts
  if (status === 'signed' && signature.resourceType === 'receipt') {
    const receipt = await receiptsAdapter.getReceiptById(
      signature.resourceId,
      dbConnection
    )

    // Only download and upload if receipt doesn't have a file yet
    if (receipt && !receipt.fileId) {
      logger.info(
        { receiptId: receipt.id, signatureId: signature.id },
        'Downloading signed PDF from SimpleSign'
      )

      // Download signed PDF from SimpleSign
      const pdfBuffer = await simpleSignApi.downloadSignedPdf(
        signature.simpleSignDocumentId
      )

      // Upload to MinIO
      const minioFileId = await uploadFile(
        pdfBuffer,
        `receipt-${signature.resourceId}-signed.pdf`,
        {
          'Content-Type': 'application/pdf',
          'x-amz-meta-signed': 'true',
          'x-amz-meta-signature-id': signature.id,
        }
      )

      // Update receipt with fileId
      await receiptsAdapter.updateReceipt(
        signature.resourceId,
        { fileId: minioFileId },
        dbConnection
      )

      // Mark other pending signatures as superseded
      await supersedePendingSignatures(
        signature.resourceType,
        signature.resourceId,
        signature.id,
        dbConnection
      )

      logger.info(
        { receiptId: signature.resourceId, fileId: minioFileId },
        'Signed PDF uploaded to MinIO'
      )
    } else if (receipt && receipt.fileId) {
      logger.info(
        { receiptId: signature.resourceId },
        'Receipt already has fileId, skipping upload'
      )
    }
  }
}

/**
 * Sync signature status from SimpleSign API and process if signed
 * Used for manual status refresh
 */
export async function syncSignatureFromSimpleSign(
  signatureId: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<Signature> {
  const signature = await getSignatureById(signatureId, dbConnection)

  if (!signature) {
    throw new Error(`Signature not found: ${signatureId}`)
  }

  // Fetch latest status from SimpleSign
  const documentDetails = await simpleSignApi.getDocumentDetails(
    signature.simpleSignDocumentId
  )

  logger.info(
    { signatureId: signature.id, status: documentDetails.status },
    'Fetched signature status from SimpleSign'
  )

  // Process the document in a transaction
  await dbConnection.transaction(async (trx) => {
    await processSignedDocument(
      signature,
      documentDetails.status,
      documentDetails.status === 'signed'
        ? new Date(documentDetails.status_updated_at)
        : undefined,
      trx
    )
  })

  // Return updated signature
  const updatedSignature = await getSignatureById(signatureId, dbConnection)
  if (!updatedSignature) {
    throw new Error(`Failed to retrieve updated signature: ${signatureId}`)
  }

  return updatedSignature
}
