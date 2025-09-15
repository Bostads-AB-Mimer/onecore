import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'

import * as economyAdapter from '@/services/economy-service/core-adapter'
import { makeResponseBody } from '../utils'

export const routes = (router: KoaRouter) => {
  router.get('/invoices/:invoiceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoiceByInvoiceId(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.statusCode
      return
    }

    ctx.status = 200
    ctx.body = makeResponseBody(result.data, metadata)
  })

  router.get('/invoices/by-contact-code/:contactCode', async (ctx) => {
    const result = await economyAdapter.getInvoicesByContactCode(
      ctx.params.contactCode
    )

    if (!result.ok) {
      ctx.status = result.statusCode
      return
    }

    ctx.status = 200
    ctx.body = makeResponseBody(result.data, generateRouteMetadata(ctx))
  })
}
