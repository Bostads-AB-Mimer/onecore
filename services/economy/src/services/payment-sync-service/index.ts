import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { z } from 'zod'

import { getPaymentsSince } from '../common/adapters/xledger-adapter'
import { recordPaymentForInvoice } from '../../common/adapters/tenfast/tenfast-adapter'

const GetPaymentsSinceQuerySchema = z.object({
  after: z.string().optional(),
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
      ctx.body = { message: 'Invalid query parameters' }
      return
    }

    try {
      const afterCursor = queryParams.data.after ?? null
      const result = await getPaymentsSince(afterCursor)
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result, metadata)
    } catch (err: any) {
      logger.error(err, 'payment-sync-service: GET /payments/since')
      ctx.status = 500
      ctx.body = { message: err.message }
    }
  })

  // Records a payment transaction in Tenfast for the invoice identified by OCR number.
  // Tenfast updates the invoice state internally based on accumulated transactions.
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
        amount,
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
