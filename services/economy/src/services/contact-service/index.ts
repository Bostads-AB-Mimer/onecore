import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { getContacts } from './service'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const contacts = await getContacts()
      ctx.body = makeSuccessResponseBody(contacts, metadata)
    } catch (err: unknown) {
      logger.error(err, 'Error getting contacts')
      ctx.status = 500
    }
  })
}
