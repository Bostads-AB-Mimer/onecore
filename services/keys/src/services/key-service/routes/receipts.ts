import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { keys } from '@onecore/types'
import * as receiptsAdapter from '../adapters/receipts-adapter'

const {
  CreateReceiptRequestSchema,
  UpdateReceiptRequestSchema,
  ErrorResponseSchema,
  NotFoundResponseSchema,
  BadRequestResponseSchema,
  ReceiptSchema,
} = keys
type CreateReceiptRequest = keys.CreateReceiptRequest
type UpdateReceiptRequest = keys.UpdateReceiptRequest
type Receipt = keys.Receipt

const IdParamSchema = z.object({ id: z.string().uuid() })
const KeyLoanParamSchema = z.object({ keyLoanId: z.string().uuid() })

export const routes = (router: KoaRouter) => {
  registerSchema('CreateReceiptRequest', CreateReceiptRequestSchema)
  registerSchema('UpdateReceiptRequest', UpdateReceiptRequestSchema)
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Receipt'
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
   * /receipts/{id}:
   *   put:
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
  router.put(
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

      const receipt = await receiptsAdapter.getReceiptById(parse.data.id, db)
      if (!receipt) {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
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
