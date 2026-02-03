import { Knex } from 'knex'
import { db } from './db'
import { keys } from '@onecore/types'

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
