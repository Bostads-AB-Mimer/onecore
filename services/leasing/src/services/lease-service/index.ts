/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { getLease, getLeases } from './adapters/tenant-lease-adapter'
import { Lease } from '../../common/types'

export const routes = (router: KoaRouter) => {
  /**
   * Returns a lease with populated sub objects
   */
  router.get('(.*)/leases/:id', async (ctx) => {
    const responseData = await getLease(ctx.params.id)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns all leases with populated sub objects
   */
  router.get('(.*)/leases', async (ctx) => {
    const leases = await getLeases()

    ctx.body = {
      data: leases,
    }
  })
}
