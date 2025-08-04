import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from 'onecore-utilities'

export const routes = (router: KoaRouter) => {
  router.post('(.*)/offers/:offerId/accept', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q'])

    const result = await coreAdapter.acceptOffer(ctx.params.offerId)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
    }
  })

  router.post('(.*)/offers/:offerId/deny', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q'])

    const result = await coreAdapter.denyOffer(ctx.params.offerId)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
    }
  })
}
