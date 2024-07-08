import KoaRouter from '@koa/router'

import * as tenantLeaseAdapter from '../adapters/xpand/tenant-lease-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/contacts/search', async (ctx) => {
    if (typeof ctx.query.q !== 'string') {
      ctx.status = 400
      return
    }

    const result = await tenantLeaseAdapter.getContactsDataBySearchQuery(
      ctx.query.q
    )

    if (!result.ok) {
      ctx.status = 500
      return
    }

    ctx.status = 200
    ctx.body = { data: result.data }
  })
}
