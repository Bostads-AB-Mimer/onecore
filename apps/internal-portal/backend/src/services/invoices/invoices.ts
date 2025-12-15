import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import * as coreAdapter from './core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/invoices/:invoiceId/payment-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await coreAdapter.getInvoicePaymentEvents(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })
}
