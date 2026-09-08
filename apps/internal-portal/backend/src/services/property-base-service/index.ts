import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'

import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/market-areas', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await coreAdapter.listMarketAreas()

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
    }
  })
}
