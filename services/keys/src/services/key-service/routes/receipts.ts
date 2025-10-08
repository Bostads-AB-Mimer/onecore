import KoaRouter from '@koa/router'
import { z } from 'zod'
import multer from '@koa/multer'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { uploadFile, getFileUrl, deleteFile } from '../adapters/minio'
import { keys } from '@onecore/types'

const TABLE = 'receipts'

const { CreateReceiptRequestSchema, ReceiptSchema } = keys.v1
type CreateReceiptRequest = keys.v1.CreateReceiptRequest
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

const IdParamSchema = z.object({ id: z.string().uuid() })
const KeyLoanParamSchema = z.object({ keyLoanId: z.string().uuid() })
const LeaseParamSchema = z.object({ leaseId: z.string().min(1) })

export const routes = (router: KoaRouter) => {
  registerSchema('CreateReceiptRequest', CreateReceiptRequestSchema)
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

        const existing = await db(TABLE)
          .where({ keyLoanId: payload.keyLoanId })
          .first()
        if (existing) {
          ctx.status = 409
          ctx.body = {
            reason: 'Receipt already exists for this keyLoanId',
            ...metadata,
          }
          return
        }

        const [row] = await db(TABLE)
          .insert({
            keyLoanId: payload.keyLoanId,
            receiptType: payload.receiptType,
            type: payload.type,
            signed: payload.signed ?? false,
            leaseId: payload.leaseId,
            fileId: payload.fileId ?? null,
          })
          .returning('*')

        ctx.status = 201
        ctx.body = { content: row as Receipt, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating receipt')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /receipts/by-lease/{leaseId}:
   *   get:
   *     summary: List receipts by lease
   *     tags: [Receipts]
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of receipts
   */
  router.get('/receipts/by-lease/:leaseId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = LeaseParamSchema.safeParse({ leaseId: ctx.params.leaseId })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid leaseId', ...metadata }
        return
      }

      const rows = await db(TABLE)
        .where({ leaseId: parse.data.leaseId })
        .orderBy('createdAt', 'desc')

      ctx.status = 200
      ctx.body = { content: rows as Receipt[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing receipts by lease')
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

      const row = await db(TABLE)
        .where({ keyLoanId: parse.data.keyLoanId })
        .first()
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row as Receipt, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching receipt by keyLoanId')
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
  router.post('/receipts/:id/upload', upload.single('file'), async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid receipt id', ...metadata }
        return
      }

      const receipt = await db(TABLE).where({ id: parse.data.id }).first()
      if (!receipt) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }

      if (!ctx.file || !ctx.file.buffer) {
        ctx.status = 400
        ctx.body = { reason: 'No file provided', ...metadata }
        return
      }

      const fileName = `${parse.data.id}-${Date.now()}.pdf`
      const fileId = await uploadFile(ctx.file.buffer, fileName, {
        'receipt-id': parse.data.id,
        'receipt-type': receipt.receiptType,
        'lease-id': receipt.leaseId,
      })

      await db(TABLE).where({ id: parse.data.id }).update({ fileId })

      ctx.status = 200
      ctx.body = {
        content: { fileId, fileName, size: ctx.file.size },
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'Error uploading file')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

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
  router.get('/receipts/:id/download', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parse = IdParamSchema.safeParse({ id: ctx.params.id })
      if (!parse.success) {
        ctx.status = 400
        ctx.body = { reason: 'Invalid receipt id', ...metadata }
        return
      }

      const receipt = await db(TABLE).where({ id: parse.data.id }).first()
      if (!receipt) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }

      if (!receipt.fileId) {
        ctx.status = 404
        ctx.body = { reason: 'No file attached to this receipt', ...metadata }
        return
      }

      const expirySeconds = 7 * 24 * 60 * 60 // 7 days
      const url = await getFileUrl(receipt.fileId, expirySeconds)

      ctx.status = 200
      ctx.body = {
        content: { url, expiresIn: expirySeconds, fileId: receipt.fileId },
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'Error generating download URL')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

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

      const receipt = await db(TABLE).where({ id: parse.data.id }).first()
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

      await db(TABLE).where({ id: parse.data.id }).del()
      ctx.status = 204
    } catch (err) {
      logger.error(err, 'Error deleting receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
