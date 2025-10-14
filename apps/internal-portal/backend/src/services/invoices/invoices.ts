import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'
import { getUnpaidInvoices } from '../common/adapters/core-adapter'

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

  router.get('(.*)/invoices/unpaid', async (ctx) => {
    const queryParams = economy.GetUnpaidInvoicesQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    try {
      const { offset, size } = queryParams.data || {}
      const response = await getUnpaidInvoices(offset, size)

      ctx.body = {
        content: response.data.content,
        ok: true,
      }
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error)
      ctx.status = 500
      ctx.body = {
        error: 'Failed to fetch unpaid invoices',
        ok: false,
      }
    }
  })
}
