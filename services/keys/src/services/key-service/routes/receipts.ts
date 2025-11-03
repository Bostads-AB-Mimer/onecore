import KoaRouter from '@koa/router'
import { z } from 'zod'
import multer from '@koa/multer'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import {
  createFileUploadHandler,
  createFileDownloadHandler,
} from '../../../utils/file-upload-routes'
import { uploadFile, deleteFile } from '../adapters/minio'
import { keys } from '@onecore/types'
import * as receiptsAdapter from '../adapters/receipts-adapter'
import * as receiptActivationService from '../receipt-activation-service'

const {
  CreateReceiptRequestSchema,
  UpdateReceiptRequestSchema,
  UploadBase64RequestSchema,
  ErrorResponseSchema,
  NotFoundResponseSchema,
  BadRequestResponseSchema,
  ReceiptSchema,
} = keys.v1
type CreateReceiptRequest = keys.v1.CreateReceiptRequest
type UpdateReceiptRequest = keys.v1.UpdateReceiptRequest
type UploadBase64Request = keys.v1.UploadBase64Request
type Receipt = keys.v1.Receipt

// Configure multer for in-memory storage (we'll upload to MinIO)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are allowed'), false)
  },
})

const IdParamSchema = z.object({ id: z.string().uuid() }) // Used by upload-base64 endpoint
const KeyLoanParamSchema = z.object({ keyLoanId: z.string().uuid() })

export const routes = (router: KoaRouter) => {
  registerSchema('CreateReceiptRequest', CreateReceiptRequestSchema)
  registerSchema('UpdateReceiptRequest', UpdateReceiptRequestSchema)
  registerSchema('UploadBase64Request', UploadBase64RequestSchema)
  registerSchema('ErrorResponse', ErrorResponseSchema)
  registerSchema('NotFoundResponse', NotFoundResponseSchema)
  registerSchema('BadRequestResponse', BadRequestResponseSchema)
  registerSchema('Receipt', ReceiptSchema)

  /**
   * @swagger
   * /receipts:
   *   post:
   *     summary: Create a receipt
   *     tags: [Receipts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateReceiptRequest'
   *     responses:
   *       201:
   *         description: Receipt created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Receipt'
   *       409:
   *         description: Receipt already exists for this keyLoanId
   */
  router.post(
    '/receipts',
    parseRequestBody(CreateReceiptRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateReceiptRequest = ctx.request.body

        // Validate that the key loan exists
        const loanExists = await receiptsAdapter.keyLoanExists(
          payload.keyLoanId,
          db
        )
        if (!loanExists) {
          ctx.status = 404
          ctx.body = {
            reason: 'Key loan not found',
            ...metadata,
          }
          return
        }

        // Allow multiple receipts per keyLoan (e.g., LOAN + RETURN, or multiple partial returns)
        const row = await receiptsAdapter.createReceipt(payload, db)

        ctx.status = 201
        ctx.body = { content: row, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating receipt')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /receipts/{id}:
   *   get:
   *     summary: Get a receipt by ID
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Receipt
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Receipt'
   *       404:
   *         description: Receipt not found
   */
  router.get('/receipts/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid receipt id', ...metadata }
        return
      }

      const receipt = await receiptsAdapter.getReceiptById(parse.data.id, db)
      if (!receipt) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: receipt, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching receipt by id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /receipts/by-key-loan/{keyLoanId}:
   *   get:
   *     summary: Get receipt by keyLoanId
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: keyLoanId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Receipt
   *       404:
   *         description: Receipt not found
   */
  router.get('/receipts/by-key-loan/:keyLoanId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = KeyLoanParamSchema.safeParse({
        keyLoanId: ctx.params.keyLoanId,
      })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid keyLoanId', ...metadata }
        return
      }

      const rows = await receiptsAdapter.getReceiptsByKeyLoanId(
        parse.data.keyLoanId,
        db
      )

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching receipts by keyLoanId')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /receipts/{id}/upload:
   *   post:
   *     summary: Upload PDF file for a receipt
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *       400:
   *         description: Invalid file or receipt not found
   *       404:
   *         description: Receipt not found
   *       413:
   *         description: File too large
   */
  router.post(
    '/receipts/:id/upload',
    upload.single('file'),
    createFileUploadHandler({
      entityName: 'receipt',
      filePrefix: 'receipt',
      getEntityById: receiptsAdapter.getReceiptById,
      getFileId: (receipt) => receipt.fileId,
      updateFileId: receiptsAdapter.updateReceiptFileId,
      getFileMetadata: (receipt, entityId) => ({
        'receipt-id': entityId,
        'receipt-type': receipt.receiptType,
        'key-loan-id': receipt.keyLoanId,
      }),
      // Business logic: If this is a LOAN receipt, activate the key loan
      onUploadSuccess: async (receipt, fileId, db) => {
        if (receipt.receiptType === 'LOAN') {
          const result = await receiptActivationService.activateLoanReceipt(
            { receiptId: receipt.id, fileId },
            db
          )

          if (result.ok) {
            logger.info(
              {
                keyLoanId: receipt.keyLoanId,
                receiptId: receipt.id,
                keyLoanActivated: result.data.keyLoanActivated,
                keyEventsCompleted: result.data.keyEventsCompleted,
              },
              'Key loan activated after signed receipt uploaded'
            )
          } else {
            logger.error(
              { receiptId: receipt.id, error: result.err },
              'Failed to activate loan receipt'
            )
          }
        }
      },
      downloadUrlExpirySeconds: 7 * 24 * 60 * 60, // 7 days
    })(db)
  )

  /**
   * @swagger
   * /receipts/{id}/upload-base64:
   *   post:
   *     summary: Upload PDF file for a receipt (base64 encoded - for Power Automate)
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UploadBase64Request'
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *       400:
   *         description: Invalid base64 content or receipt not found
   *       404:
   *         description: Receipt not found
   *       413:
   *         description: File too large (max 10MB)
   */
  router.post(
    '/receipts/:id/upload-base64',
    parseRequestBody(UploadBase64RequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const parse = IdParamSchema.safeParse({ id: ctx.params.id })
        if (!parse.success) {
          ctx.status = 400
          ctx.body = { reason: 'Invalid receipt id', ...metadata }
          return
        }

        const receipt = await receiptsAdapter.getReceiptById(parse.data.id, db)
        if (!receipt) {
          ctx.status = 404
          ctx.body = { reason: 'Receipt not found', ...metadata }
          return
        }

        const payload: UploadBase64Request = ctx.request.body

        // Decode base64 to Buffer
        let fileBuffer: Buffer
        try {
          fileBuffer = Buffer.from(payload.fileContent, 'base64')
        } catch (_err) {
          ctx.status = 400
          ctx.body = { reason: 'Invalid base64 content', ...metadata }
          return
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024
        if (fileBuffer.length > maxSize) {
          ctx.status = 413
          ctx.body = {
            reason: `File too large. Maximum size is 10MB, got ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`,
            ...metadata,
          }
          return
        }

        // Validate PDF header (PDF files start with %PDF-)
        const pdfHeader = fileBuffer.slice(0, 5).toString('utf-8')
        if (pdfHeader !== '%PDF-') {
          ctx.status = 400
          ctx.body = {
            reason: 'Invalid PDF file. File must be a valid PDF document.',
            ...metadata,
          }
          return
        }

        const fileName =
          payload.fileName || `${parse.data.id}-${Date.now()}.pdf`
        const uploadMetadata = {
          'receipt-id': parse.data.id,
          'receipt-type': receipt.receiptType,
          'key-loan-id': receipt.keyLoanId,
          ...(payload.metadata || {}),
        }

        const fileId = await uploadFile(fileBuffer, fileName, uploadMetadata)

        // Update receipt with fileId (fileId presence indicates signed status)
        await receiptsAdapter.updateReceiptFileId(parse.data.id, fileId, db)

        // If this is a LOAN receipt, activate the key loan by setting pickedUpAt
        if (receipt.receiptType === 'LOAN') {
          const result = await receiptActivationService.activateLoanReceipt(
            { receiptId: parse.data.id, fileId },
            db
          )

          if (result.ok) {
            logger.info(
              {
                keyLoanId: receipt.keyLoanId,
                receiptId: parse.data.id,
                keyLoanActivated: result.data.keyLoanActivated,
                keyEventsCompleted: result.data.keyEventsCompleted,
              },
              'Key loan activated after signed receipt uploaded via base64'
            )
          } else {
            logger.error(
              { receiptId: parse.data.id, error: result.err },
              'Failed to activate loan receipt via base64 upload'
            )
          }
        }

        ctx.status = 200
        ctx.body = {
          content: {
            fileId,
            fileName,
            size: fileBuffer.length,
            source: 'base64',
          },
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'Error uploading base64 file')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /receipts/{id}/download:
   *   get:
   *     summary: Get presigned download URL for receipt PDF
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Download URL generated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 url:
   *                   type: string
   *                 expiresIn:
   *                   type: number
   *       404:
   *         description: Receipt or file not found
   */
  router.get(
    '/receipts/:id/download',
    createFileDownloadHandler({
      entityName: 'receipt',
      filePrefix: 'receipt',
      getEntityById: receiptsAdapter.getReceiptById,
      getFileId: (receipt) => receipt.fileId,
      updateFileId: receiptsAdapter.updateReceiptFileId,
      downloadUrlExpirySeconds: 7 * 24 * 60 * 60, // 7 days
    })(db)
  )

  /**
   * @swagger
   * /receipts/{id}:
   *   patch:
   *     summary: Update a receipt (allows marking as signed)
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateReceiptRequest'
   *     responses:
   *       200:
   *         description: Receipt updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Receipt'
   *       404:
   *         description: Receipt not found
   */
  router.patch(
    '/receipts/:id',
    parseRequestBody(UpdateReceiptRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const parse = IdParamSchema.safeParse({ id: ctx.params.id })
        if (!parse.success) {
          ctx.status = 400
          ctx.body = { reason: 'Invalid receipt id', ...metadata }
          return
        }

        const receipt = await receiptsAdapter.getReceiptById(parse.data.id, db)
        if (!receipt) {
          ctx.status = 404
          ctx.body = { reason: 'Receipt not found', ...metadata }
          return
        }

        const payload: UpdateReceiptRequest = ctx.request.body
        const updated = await receiptsAdapter.updateReceipt(
          parse.data.id,
          payload,
          db
        )

        ctx.status = 200
        ctx.body = { content: updated as Receipt, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error updating receipt')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /receipts/{id}:
   *   delete:
   *     summary: Delete a receipt by id (and associated file)
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Receipt not found
   */
  router.delete('/receipts/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid id', ...metadata }
        return
      }

      const receipt = await receiptsAdapter.getReceiptById(parse.data.id, db)
      if (!receipt) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }

      if (receipt.fileId) {
        try {
          await deleteFile(receipt.fileId)
          logger.info({ fileId: receipt.fileId }, 'File deleted from MinIO')
        } catch (err) {
          logger.warn(
            { err, fileId: receipt.fileId },
            'Failed to delete file from MinIO'
          )
        }
      }

      await receiptsAdapter.deleteReceipt(parse.data.id, db)
      ctx.status = 204
    } catch (err) {
      logger.error(err, 'Error deleting receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
