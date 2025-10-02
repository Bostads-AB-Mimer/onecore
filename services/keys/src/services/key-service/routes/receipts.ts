import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'

const TABLE = 'receipts'

// ----- Schemas (OpenAPI + runtime validation)
const CreateReceiptRequestSchema = z.object({
  keyLoanId: z.string().uuid(),
  receiptType: z.enum(['LOAN', 'RETURN']),
  leaseId: z.string().min(1),
  fileId: z.string().optional(), // blob/UNC id (optional for now)
})
type CreateReceiptRequest = z.infer<typeof CreateReceiptRequestSchema>

const ReceiptSchema = z.object({
  id: z.string().uuid(),
  keyLoanId: z.string().uuid(),
  receiptType: z.enum(['LOAN', 'RETURN']),
  leaseId: z.string(),
  fileId: z.string().nullable().optional(),
  createdAt: z.string(), // ISO
})
type ReceiptResponse = z.infer<typeof ReceiptSchema>

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

        // Optional defensive check: receipt already exists for this keyLoan?
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
            leaseId: payload.leaseId,
            fileId: payload.fileId ?? null,
          })
          .returning('*')

        ctx.status = 201
        ctx.body = { content: row as ReceiptResponse, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating receipt')
        ctx.status = 500
        ctx.body = {
          error: 'Internal server error',
          ...generateRouteMetadata(ctx),
        }
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
      ctx.body = { content: rows as ReceiptResponse[], ...metadata }
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
      ctx.body = { content: row as ReceiptResponse, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching receipt by keyLoanId')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /receipts/{id}:
   *   delete:
   *     summary: Delete a receipt by id
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

      const deleted = await db(TABLE).where({ id: parse.data.id }).del()
      if (!deleted) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
      }

      ctx.status = 204
    } catch (err) {
      logger.error(err, 'Error deleting receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
