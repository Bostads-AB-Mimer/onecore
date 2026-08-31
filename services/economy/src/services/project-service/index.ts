import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { getProjects } from './service'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/projects', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const projects = await getProjects()
      ctx.body = makeSuccessResponseBody(projects, metadata)
    } catch (err: unknown) {
      logger.error(err, 'Error getting projects')
      ctx.status = 500
    }
  })
}
