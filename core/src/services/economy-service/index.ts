import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'

import * as economyAdapter from '../../adapters/economy-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Economy service
 *     description: Operations related to economy
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  router.get('/invoices/:invoiceId/payment-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicePaymentEvents(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.statusCode ?? 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/:contactCode/credit-check', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicesSentToDebtCollection(
      ctx.params.contactCode
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/:invoiceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoiceByInvoiceId(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/by-contact-code/:contactCode', async (ctx) => {
    const queryParams = economy.GetInvoicesByContactCodeQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicesByContactCode(
      ctx.params.contactCode,
      queryParams.data
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error: result.err === 'not-found' ? 'Not found' : 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        { data: result.data, totalCount: result.data.length },
        metadata
      )
    }
  })
}
