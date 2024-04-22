import KoaRouter from '@koa/router'
import {getListingsWithApplicants} from "./adapters/core-adapter";

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/listings-with-applicants', async (ctx) => {
    const listings = await getListingsWithApplicants()

    ctx.body = listings
  })
}
