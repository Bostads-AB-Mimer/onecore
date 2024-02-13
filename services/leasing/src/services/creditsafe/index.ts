import KoaRouter from '@koa/router'
import { getCreditInformation } from './adapters/creditsafe-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/cas/getConsumerReport/:pnr', async (ctx) => {
    const responseData = await getCreditInformation(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })
}
