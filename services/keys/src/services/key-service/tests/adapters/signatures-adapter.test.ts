import * as signaturesAdapter from '../../adapters/signatures-adapter'
import * as receiptsAdapter from '../../adapters/receipts-adapter'
import * as keyLoansAdapter from '../../adapters/key-loans-adapter'
import * as factory from '../factories'
import { withContext } from '../testUtils'

/**
 * Integration tests for signatures-adapter
 *
 * These tests verify:
 * - CRUD operations on signatures table
 * - SimpleSign document ID lookups
 * - Resource-based signature queries
 * - Status updates (webhook handling)
 * - Superseding pending signatures
 * - Cleanup of old signatures
 *
 * Pattern adopted from services/leasing adapter tests
 */

/**
 * Helper to strip auto-generated fields from factory.receipt.build()
 */
function buildReceiptData(overrides: any = {}) {
  const base = factory.receipt.build(overrides)
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = base
  // Convert null to undefined for fileId
  return {
    ...data,
    fileId: data.fileId ?? undefined,
  }
}

/**
 * Helper to create a receipt for testing signatures
 */
async function createTestReceipt(ctx: any) {
  const keyLoan = await keyLoansAdapter.createKeyLoan(
    factory.keyLoan.build(),
    ctx.db
  )
  const receipt = await receiptsAdapter.createReceipt(
    buildReceiptData({ keyLoanId: keyLoan.id }),
    ctx.db
  )
  return receipt
}

/**
 * Helper to build signature data with real receipt ID
 * Removes auto-generated fields (id, sentAt, completedAt, lastSyncedAt)
 */
async function buildSignatureData(ctx: any, overrides: any = {}) {
  const receipt = await createTestReceipt(ctx)
  const base = factory.signature.build({
    ...overrides,
    resourceId: receipt.id,
  })
  // Strip auto-generated fields
  const {
    id: _id,
    sentAt: _sentAt,
    completedAt: _completedAt,
    lastSyncedAt: _lastSyncedAt,
    ...data
  } = base
  return data
}

describe('signatures-adapter', () => {
  describe('createSignature', () => {
    it('creates a signature in the database', () =>
      withContext(async (ctx) => {
        const receipt = await createTestReceipt(ctx)

        const signatureData = {
          resourceType: 'receipt' as const,
          resourceId: receipt.id,
          simpleSignDocumentId: 12345,
          recipientEmail: 'test@example.com',
          recipientName: 'Test User',
          status: 'sent',
        }

        const signature = await signaturesAdapter.createSignature(
          signatureData,
          ctx.db
        )

        expect(signature.id).toBeDefined()
        expect(signature.resourceType).toBe('receipt')
        expect(signature.resourceId).toBe(receipt.id)
        expect(signature.simpleSignDocumentId).toBe(12345)
        expect(signature.recipientEmail).toBe('test@example.com')
        expect(signature.status).toBe('sent')
        expect(signature.sentAt).toBeDefined()
      }))
  })

  describe('getSignatureById', () => {
    it('returns signature when it exists', () =>
      withContext(async (ctx) => {
        const created = await signaturesAdapter.createSignature(
          await buildSignatureData(ctx, { recipientEmail: 'find@example.com' }),
          ctx.db
        )

        const signature = await signaturesAdapter.getSignatureById(
          created.id,
          ctx.db
        )

        expect(signature).toBeDefined()
        expect(signature?.id).toBe(created.id)
        expect(signature?.recipientEmail).toBe('find@example.com')
      }))
  })

  describe('getSignatureBySimpleSignDocumentId', () => {
    it('returns signature by SimpleSign document ID', () =>
      withContext(async (ctx) => {
        const created = await signaturesAdapter.createSignature(
          await buildSignatureData(ctx, { simpleSignDocumentId: 54321 }),
          ctx.db
        )

        const signature =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            54321,
            ctx.db
          )

        expect(signature).toBeDefined()
        expect(signature?.id).toBe(created.id)
        expect(signature?.simpleSignDocumentId).toBe(54321)
      }))
  })

  describe('getSignaturesByResourceId', () => {
    it('returns all signatures for a resource ordered by sentAt desc', () =>
      withContext(async (ctx) => {
        const receipt = await createTestReceipt(ctx)

        const sig1 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 10001,
            recipientEmail: 'first@example.com',
            status: 'sent',
          },
          ctx.db
        )

        // Wait to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10))

        const sig2 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 10002,
            recipientEmail: 'second@example.com',
            status: 'sent',
          },
          ctx.db
        )

        const signatures = await signaturesAdapter.getSignaturesByResourceId(
          'receipt',
          receipt.id,
          ctx.db
        )

        expect(signatures.length).toBe(2)
        // Should be ordered by sentAt desc (newest first)
        expect(signatures[0].id).toBe(sig2.id)
        expect(signatures[1].id).toBe(sig1.id)
      }))
  })

  describe('updateSignature', () => {
    it('updates signature fields successfully', () =>
      withContext(async (ctx) => {
        const signature = await signaturesAdapter.createSignature(
          await buildSignatureData(ctx, {
            status: 'sent',
            recipientEmail: 'original@example.com',
          }),
          ctx.db
        )

        const updated = await signaturesAdapter.updateSignature(
          signature.id,
          {
            status: 'signed',
            completedAt: new Date(),
          },
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.status).toBe('signed')
        expect(updated?.completedAt).toBeDefined()
        expect(updated?.recipientEmail).toBe('original@example.com') // Unchanged
      }))
  })

  describe('deleteSignature', () => {
    it('deletes signature from database', () =>
      withContext(async (ctx) => {
        const signature = await signaturesAdapter.createSignature(
          await buildSignatureData(ctx),
          ctx.db
        )

        const deleted = await signaturesAdapter.deleteSignature(
          signature.id,
          ctx.db
        )

        expect(deleted).toBe(1)
      }))
  })

  describe('updateSignatureStatus', () => {
    it('updates signature status by SimpleSign document ID', () =>
      withContext(async (ctx) => {
        const signature = await signaturesAdapter.createSignature(
          await buildSignatureData(ctx, {
            simpleSignDocumentId: 11111,
            status: 'sent',
          }),
          ctx.db
        )

        const updated = await signaturesAdapter.updateSignatureStatus(
          11111,
          'signed',
          new Date(),
          ctx.db
        )

        expect(updated).toBeDefined()
        expect(updated?.id).toBe(signature.id)
        expect(updated?.status).toBe('signed')
        expect(updated?.completedAt).toBeDefined()
        expect(updated?.lastSyncedAt).toBeDefined()
      }))

    it('updates status without completedAt', () =>
      withContext(async (ctx) => {
        await signaturesAdapter.createSignature(
          await buildSignatureData(ctx, {
            simpleSignDocumentId: 22222,
            status: 'sent',
          }),
          ctx.db
        )

        const updated = await signaturesAdapter.updateSignatureStatus(
          22222,
          'viewed',
          undefined,
          ctx.db
        )

        expect(updated?.status).toBe('viewed')
        expect(updated?.completedAt).toBeNull()
      }))
  })

  describe('supersedePendingSignatures', () => {
    it('marks other pending signatures as superseded', () =>
      withContext(async (ctx) => {
        const receipt = await createTestReceipt(ctx)

        // Create multiple sent signatures for same resource
        const sig1 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 20001,
            recipientEmail: 'sig1@example.com',
            status: 'sent',
          },
          ctx.db
        )

        const sig2 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 20002,
            recipientEmail: 'sig2@example.com',
            status: 'sent',
          },
          ctx.db
        )

        const sig3 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 20003,
            recipientEmail: 'sig3@example.com',
            status: 'sent',
          },
          ctx.db
        )

        // Supersede all except sig3
        const updated = await signaturesAdapter.supersedePendingSignatures(
          'receipt',
          receipt.id,
          sig3.id,
          ctx.db
        )

        expect(updated).toBe(2) // sig1 and sig2 updated

        // Verify status changes
        const sig1Updated = await signaturesAdapter.getSignatureById(
          sig1.id,
          ctx.db
        )
        const sig2Updated = await signaturesAdapter.getSignatureById(
          sig2.id,
          ctx.db
        )
        const sig3Updated = await signaturesAdapter.getSignatureById(
          sig3.id,
          ctx.db
        )

        expect(sig1Updated?.status).toBe('superseded')
        expect(sig2Updated?.status).toBe('superseded')
        expect(sig3Updated?.status).toBe('sent') // Not superseded
      }))

    it('does not supersede signatures with other statuses', () =>
      withContext(async (ctx) => {
        const receipt = await createTestReceipt(ctx)

        const sig1 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 20004,
            recipientEmail: 'signed@example.com',
            status: 'signed', // Already completed
          },
          ctx.db
        )

        const sig2 = await signaturesAdapter.createSignature(
          {
            resourceType: 'receipt',
            resourceId: receipt.id,
            simpleSignDocumentId: 20005,
            recipientEmail: 'sent@example.com',
            status: 'sent',
          },
          ctx.db
        )

        const updated = await signaturesAdapter.supersedePendingSignatures(
          'receipt',
          receipt.id,
          sig2.id,
          ctx.db
        )

        expect(updated).toBe(0) // sig1 not updated (status is 'signed', not 'sent')

        const sig1Updated = await signaturesAdapter.getSignatureById(
          sig1.id,
          ctx.db
        )
        expect(sig1Updated?.status).toBe('signed') // Unchanged
      }))
  })

  describe('deleteOldSignatures', () => {
    it('deletes signatures older than specified days', () =>
      withContext(async (ctx) => {
        const oldReceipt = await createTestReceipt(ctx)

        // Create old signature (100 days ago)
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 100)

        const [oldSig] = await ctx
          .db('signatures')
          .insert({
            resourceType: 'receipt',
            resourceId: oldReceipt.id,
            simpleSignDocumentId: 77777,
            recipientEmail: 'old@example.com',
            status: 'signed',
            sentAt: oldDate,
          })
          .returning('*')

        // Create recent signature
        const recentSig = await signaturesAdapter.createSignature(
          await buildSignatureData(ctx, { status: 'signed' }),
          ctx.db
        )

        // Delete signatures older than 30 days
        await signaturesAdapter.deleteOldSignatures(['signed'], 30, ctx.db)

        // Verify old signature deleted
        const oldSigFromDb = await signaturesAdapter.getSignatureById(
          oldSig.id,
          ctx.db
        )
        expect(oldSigFromDb).toBeUndefined()

        // Verify recent signature still exists
        const recentSigFromDb = await signaturesAdapter.getSignatureById(
          recentSig.id,
          ctx.db
        )
        expect(recentSigFromDb).toBeDefined()
      }))

    it('filters by status when deleting old signatures', () =>
      withContext(async (ctx) => {
        const oldReceipt = await createTestReceipt(ctx)

        // Create old signature with 'sent' status
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 100)

        const [oldSentSig] = await ctx
          .db('signatures')
          .insert({
            resourceType: 'receipt',
            resourceId: oldReceipt.id,
            simpleSignDocumentId: 88888,
            recipientEmail: 'oldsent@example.com',
            status: 'sent',
            sentAt: oldDate,
          })
          .returning('*')

        // Delete only 'signed' status (not 'sent')
        await signaturesAdapter.deleteOldSignatures(['signed'], 30, ctx.db)

        // Old 'sent' signature should still exist
        const oldSentSigFromDb = await signaturesAdapter.getSignatureById(
          oldSentSig.id,
          ctx.db
        )
        expect(oldSentSigFromDb).toBeDefined()
      }))
  })
})
