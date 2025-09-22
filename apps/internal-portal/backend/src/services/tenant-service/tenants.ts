import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import * as adapter from './core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/contact-cards/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await adapter.getContact(ctx.params.contactCode)

    if (!result.ok) {
      ctx.status = result.statusCode
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(result.data, metadata)
  })
}
