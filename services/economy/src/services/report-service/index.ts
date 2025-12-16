import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'
import { getInvoicePaymentSummaries } from './service'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/report/invoice-payment-summaries', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = economy.GetUnpaidInvoicesQueryParams.safeParse(
      ctx.query
    )
    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    try {
      const { from, to } = queryParams.data
      const invoicePaymentSummaries = await getInvoicePaymentSummaries(from, to)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(invoicePaymentSummaries, metadata)
    } catch (error: any) {
      logger.error(error, 'Error getting invoice payment summaries')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
