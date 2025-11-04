/**
 * Business logic tests for signature webhook service
 *
 * These tests verify complex transactional behavior including:
 * - Multi-step operations succeed atomically
 * - Transaction rollback on failure at any step
 * - Race condition handling
 * - External service integration (SimpleSign, MinIO)
 *
 * Pattern adopted from services/leasing offer-service tests
 */

import * as factory from './factories'
import * as signaturesAdapter from '../adapters/signatures-adapter'
import * as receiptsAdapter from '../adapters/receipts-adapter'
import * as keyLoansAdapter from '../adapters/key-loans-adapter'
import * as keysAdapter from '../adapters/keys-adapter'
import * as simpleSignApi from '../adapters/simplesign-adapter'
import * as minioAdapter from '../adapters/minio'
import * as service from '../signature-webhook-service'
import { withContext } from './testUtils'

afterEach(jest.restoreAllMocks)

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
 * Helper to create a key loan and receipt for testing
 */
async function createKeyLoanAndReceipt(ctx: any, receiptData: any = {}) {
  // Create key first
  const key = await keysAdapter.createKey(factory.key.build(), ctx.db)

  // Create key loan
  const keyLoan = await keyLoansAdapter.createKeyLoan(
    {
      keys: JSON.stringify([key.id]),
      loanType: 'TENANT' as const,
      contact: 'test@example.com',
    },
    ctx.db
  )

  // Create receipt
  const receipt = await receiptsAdapter.createReceipt(
    buildReceiptData({
      keyLoanId: keyLoan.id,
      ...receiptData,
    }),
    ctx.db
  )

  return { key, keyLoan, receipt }
}

describe('processSignatureWebhook', () => {
  describe('error handling and graceful returns', () => {
    it('returns gracefully when signature not found', () =>
      withContext(async (ctx) => {
        const result = await service.processSignatureWebhook(
          {
            documentId: 999999,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(result).toEqual({ ok: false, err: 'signature-not-found' })
      }))

    it('returns gracefully when receipt not found', () =>
      withContext(async (ctx) => {
        // Create signature but no receipt
        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 100,
            resourceType: 'receipt',
            resourceId: '00000000-0000-0000-0000-000000000001',
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(result).toEqual({ ok: false, err: 'receipt-not-found' })
      }))
  })

  describe('transaction rollback verification', () => {
    it('rollbacks signature status change if download PDF fails', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        downloadSpy.mockRejectedValueOnce(new Error('Network error'))

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 200,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(downloadSpy).toHaveBeenCalled()
        expect(result).toEqual({ ok: false, err: 'download-pdf' })

        // Verify rollback: signature status should still be 'sent'
        const signatureFromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(signatureFromDb?.status).toBe('sent')
        expect(signatureFromDb?.completedAt).toBeNull()
      }))

    it('rollbacks signature status and download if upload to MinIO fails', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')

        const mockPdfBuffer = Buffer.from('fake pdf content')
        downloadSpy.mockResolvedValueOnce(mockPdfBuffer)
        uploadSpy.mockRejectedValueOnce(new Error('MinIO connection failed'))

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 201,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(downloadSpy).toHaveBeenCalled()
        expect(uploadSpy).toHaveBeenCalled()
        expect(result).toEqual({ ok: false, err: 'upload-file' })

        // Verify rollback: signature status should still be 'sent'
        const signatureFromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(signatureFromDb?.status).toBe('sent')
        expect(signatureFromDb?.completedAt).toBeNull()

        // Verify receipt doesn't have fileId
        const receiptFromDb = await receiptsAdapter.getReceiptById(
          receipt.id,
          ctx.db
        )
        expect(receiptFromDb?.fileId).toBeNull()
      }))

    it('rollbacks all changes if update receipt fails', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')
        const updateReceiptSpy = jest.spyOn(receiptsAdapter, 'updateReceipt')

        const mockPdfBuffer = Buffer.from('fake pdf content')
        downloadSpy.mockResolvedValueOnce(mockPdfBuffer)
        uploadSpy.mockResolvedValueOnce('minio-file-123')
        updateReceiptSpy.mockResolvedValueOnce(undefined) // Simulate failure

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 202,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(updateReceiptSpy).toHaveBeenCalled()
        expect(result).toEqual({ ok: false, err: 'update-receipt' })

        // Verify complete rollback
        const signatureFromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(signatureFromDb?.status).toBe('sent')
        expect(signatureFromDb?.completedAt).toBeNull()

        const receiptFromDb = await receiptsAdapter.getReceiptById(
          receipt.id,
          ctx.db
        )
        expect(receiptFromDb?.fileId).toBeNull()
      }))

    it('rollbacks all changes if supersede pending signatures fails', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')
        const supersedeSpy = jest.spyOn(
          signaturesAdapter,
          'supersedePendingSignatures'
        )

        const mockPdfBuffer = Buffer.from('fake pdf content')
        downloadSpy.mockResolvedValueOnce(mockPdfBuffer)
        uploadSpy.mockResolvedValueOnce('minio-file-456')
        supersedeSpy.mockRejectedValueOnce(new Error('DB constraint violation'))

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 203,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(supersedeSpy).toHaveBeenCalled()
        expect(result).toEqual({ ok: false, err: 'transaction-failed' })

        // Verify complete rollback
        const signatureFromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(signatureFromDb?.status).toBe('sent')
        expect(signatureFromDb?.completedAt).toBeNull()

        const receiptFromDb = await receiptsAdapter.getReceiptById(
          receipt.id,
          ctx.db
        )
        expect(receiptFromDb?.fileId).toBeNull()
      }))
  })

  describe('successful multi-step operations', () => {
    it('updates all resources atomically when signature is signed', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')
        const supersedeSpy = jest.spyOn(
          signaturesAdapter,
          'supersedePendingSignatures'
        )

        const mockPdfBuffer = Buffer.from('signed pdf content')
        const mockFileId = 'minio-file-success-789'
        downloadSpy.mockResolvedValueOnce(mockPdfBuffer)
        uploadSpy.mockResolvedValueOnce(mockFileId)
        supersedeSpy.mockResolvedValueOnce(0) // No pending signatures to supersede

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 300,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const statusUpdatedAt = new Date().toISOString()
        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt,
          },
          ctx.db
        )

        expect(downloadSpy).toHaveBeenCalledWith(signature.simpleSignDocumentId)
        expect(uploadSpy).toHaveBeenCalledWith(
          mockPdfBuffer,
          `receipt-${receipt.id}-signed.pdf`,
          expect.objectContaining({
            'Content-Type': 'application/pdf',
            'x-amz-meta-signed': 'true',
            'x-amz-meta-signature-id': signature.id,
          })
        )
        expect(supersedeSpy).toHaveBeenCalledWith(
          'receipt',
          receipt.id,
          signature.id,
          expect.anything()
        )
        expect(result).toEqual({ ok: true, data: { fileId: mockFileId } })

        // Verify signature updated
        const updatedSignature =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(updatedSignature?.status).toBe('signed')
        expect(updatedSignature?.completedAt).toBeNearDate(
          new Date(statusUpdatedAt),
          2000
        )

        // Verify receipt updated
        const updatedReceipt = await receiptsAdapter.getReceiptById(
          receipt.id,
          ctx.db
        )
        expect(updatedReceipt?.fileId).toBe(mockFileId)
      }))

    it('supersedes other pending signatures for same resource', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')

        const mockPdfBuffer = Buffer.from('signed pdf')
        downloadSpy.mockResolvedValueOnce(mockPdfBuffer)
        uploadSpy.mockResolvedValueOnce('minio-file-999')

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        // Create multiple signatures for same receipt
        const signature1 = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 400,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const signature2 = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 401,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const signature3 = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 402,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        // Process webhook for signature3
        const result = await service.processSignatureWebhook(
          {
            documentId: signature3.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        expect(result.ok).toBe(true)

        // Verify signature3 is signed
        const sig3FromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature3.simpleSignDocumentId,
            ctx.db
          )
        expect(sig3FromDb?.status).toBe('signed')

        // Verify signature1 and signature2 are superseded
        const sig1FromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature1.simpleSignDocumentId,
            ctx.db
          )
        expect(sig1FromDb?.status).toBe('superseded')

        const sig2FromDb =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature2.simpleSignDocumentId,
            ctx.db
          )
        expect(sig2FromDb?.status).toBe('superseded')
      }))

    it('updates signature status to non-signed status without downloading PDF', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')

        // Create test data
        const { receipt } = await createKeyLoanAndReceipt(ctx)

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 500,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'declined',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        // Should not download or upload
        expect(downloadSpy).not.toHaveBeenCalled()
        expect(uploadSpy).not.toHaveBeenCalled()
        expect(result).toEqual({ ok: true, data: {} })

        // Verify signature status updated
        const updatedSignature =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(updatedSignature?.status).toBe('declined')
        expect(updatedSignature?.completedAt).toBeNull()

        // Verify receipt unchanged
        const receiptFromDb = await receiptsAdapter.getReceiptById(
          receipt.id,
          ctx.db
        )
        expect(receiptFromDb?.fileId).toBeNull()
      }))
  })

  describe('race condition handling', () => {
    it('skips processing if receipt already has fileId', () =>
      withContext(async (ctx) => {
        const downloadSpy = jest.spyOn(simpleSignApi, 'downloadSignedPdf')
        const uploadSpy = jest.spyOn(minioAdapter, 'uploadFile')
        const supersedeSpy = jest.spyOn(
          signaturesAdapter,
          'supersedePendingSignatures'
        )

        // Create receipt with existing fileId
        const { receipt } = await createKeyLoanAndReceipt(ctx, {
          fileId: 'existing-file-123',
        })

        const signature = await signaturesAdapter.createSignature(
          factory.signature.build({
            simpleSignDocumentId: 600,
            resourceType: 'receipt',
            resourceId: receipt.id,
            status: 'sent',
          }),
          ctx.db
        )

        const result = await service.processSignatureWebhook(
          {
            documentId: signature.simpleSignDocumentId,
            status: 'signed',
            statusUpdatedAt: new Date().toISOString(),
          },
          ctx.db
        )

        // Should skip download, upload, and supersede
        expect(downloadSpy).not.toHaveBeenCalled()
        expect(uploadSpy).not.toHaveBeenCalled()
        expect(supersedeSpy).not.toHaveBeenCalled()
        expect(result).toEqual({
          ok: true,
          data: { fileId: 'existing-file-123' },
        })

        // Verify signature status still updated
        const updatedSignature =
          await signaturesAdapter.getSignatureBySimpleSignDocumentId(
            signature.simpleSignDocumentId,
            ctx.db
          )
        expect(updatedSignature?.status).toBe('signed')
      }))
  })
})
