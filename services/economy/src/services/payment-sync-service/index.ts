import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'
import { z } from 'zod'

import {
  getLatestPaymentCursor,
  getPaymentsSince,
} from '../common/adapters/xledger-adapter'
import { recordPaymentForInvoice } from '../../common/adapters/tenfast/tenfast-adapter'

const GetPaymentsSinceQuerySchema = z.object({
  after: z.string(),
})

const RecordPaymentBodySchema = z.object({
  amount: z.number(),
  dateTime: z.string().datetime(),
  method: z.string(),
})

export function routes(router: KoaRouter) {
  router.get('(.*)/payments/since', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const queryParams = GetPaymentsSinceQuerySchema.safeParse(ctx.query)
    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        message:
          'Missing or invalid "after" query parameter (cursor string required)',
      }
      return
    }

    try {
      const result = await getPaymentsSince(queryParams.data.after)
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result, metadata)
    } catch (err: any) {
      logger.error(err, 'payment-sync-service: GET /payments/since')
      ctx.status = 500
      ctx.body = { message: err.message }
    }
  })

  router.get('(.*)/payments/latest-cursor', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const cursor = await getLatestPaymentCursor()
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(cursor, metadata)
    } catch (err: any) {
      logger.error(err, 'payment-sync-service: GET /payments/latest-cursor')
      ctx.status = 500
      ctx.body = { message: err.message }
    }
  })

  /**
   * @swagger
   * /invoices/{invoiceId}/payments:
   *   post:
   *     summary: Record a payment in Tenfast
   *     description: Records a payment transaction in Tenfast for the invoice identified by OCR number. Tenfast updates the invoice state from its accumulated transactions.
   *     tags: [Payments]
   *     parameters:
   *       - in: path
   *         name: invoiceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The invoice's OCR number
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *               - dateTime
   *               - method
   *             properties:
   *               amount:
   *                 type: number
   *                 description: Payment amount. Negative Xledger amounts are recorded as positive.
   *               dateTime:
   *                 type: string
   *                 format: date-time
   *               method:
   *                 type: string
   *     responses:
   *       200:
   *         description: Payment recorded.
   *       400:
   *         description: Invalid request body.
   *       404:
   *         description: No invoice with this OCR number in Tenfast.
   *       409:
   *         description: Tenfast refused the payment, e.g. because the invoice is voided or the payment date is in a locked accounting period.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   enum: [payment-rejected]
   *                 reason:
   *                   type: string
   *                   description: Tenfast's reason for refusing the payment.
   *       500:
   *         description: Tenfast could not be reached or answered unexpectedly.
   */
  router.post('(.*)/invoices/:invoiceId/payments', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const body = RecordPaymentBodySchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = {
        message:
          'Invalid request body: amount, dateTime and method are required',
      }
      return
    }

    const { invoiceId } = ctx.params
    const { amount, dateTime, method } = body.data

    try {
      const result = await recordPaymentForInvoice({
        ocr: invoiceId,
        // Xledger payments are negative AR credits; convert to positive for Tenfast.
        amount: Math.abs(amount),
        dateTime: new Date(dateTime),
        method,
      })

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            message: `Invoice with OCR ${invoiceId} not found in Tenfast`,
          }
          return
        }
        if (result.err === 'payment-rejected') {
          ctx.status = 409
          ctx.body = {
            error: 'payment-rejected',
            reason: result.detail ?? '',
          } satisfies economy.RecordPaymentRejectedResponse
          return
        }
        ctx.status = 500
        ctx.body = { message: 'Failed to record payment in Tenfast' }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(null, metadata)
    } catch (err: any) {
      logger.error(
        err,
        'payment-sync-service: POST /invoices/:invoiceId/payments'
      )
      ctx.status = 500
      ctx.body = { message: err.message }
    }
  })
}
