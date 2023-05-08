/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { getRandomData } from './adapters/random-data-api-adapter'

const performSearch = async () => {
  return await getRandomData()
}

/**
 * The routes of this service are exported as the routes object. The service can also have
 * other exports (named or default) to provide externally usable helper functions, types etc.
 */
export const routes = (router: KoaRouter) => {
  router.get('/search', async (ctx) => {
    const { query } = ctx.request

    if (!query.freeTextQuery) {
      ctx.status = 400
      ctx.body = { errorMessage: 'Missing parameter: freeTextQuery' }
      return
    }

    const responseData = await performSearch()

    ctx.body = {
      results: responseData,
      freeTextQuery: ctx.request.query.freeTextQuery,
    }
  })
}
