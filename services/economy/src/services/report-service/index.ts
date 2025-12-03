import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'
import { getUnpaidShit } from './service'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/report/unpaid', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = economy.GetUnpaidInvoicesQueryParams.safeParse(
      ctx.query
    )
    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    try {
      const { from, to, offset = 0, size = 50 } = queryParams.data
      const bajskorv = await getUnpaidShit(from, to, offset, size)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(bajskorv, metadata)
    } catch (error: any) {
      console.log('error: ', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
