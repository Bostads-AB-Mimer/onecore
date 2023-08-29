/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import {
  getContactForPnr,
  getLease,
  getLeasesForPnr,
} from './adapters/tenant-lease-adapter'
import { Lease } from '../../common/types'

const getLeaseWithRelatedEntities = async (rentalId: string) => {
  const lease = await getLease(rentalId)

  return lease
}

const getLeasesWithRelatedEntitiesForPnr = async (
  nationalRegistrationNumber: string
) => {
  const leases = await getLeasesForPnr(nationalRegistrationNumber)

  return leases
}

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/for/:pnr', async (ctx) => {
    const responseData = await getLeasesWithRelatedEntitiesForPnr(
      ctx.params.pnr
    )

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns a contact
   */
  router.get('(.*)/contact/:pnr', async (ctx: any) => {
    const responseData = await getContactForPnr(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns a lease with populated sub objects
   */
  router.get('(.*)/leases/:id', async (ctx) => {
    const responseData = await getLeaseWithRelatedEntities(ctx.params.id)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns all leases with populated sub objects
   */
  /*  router.get('(.*)/leases', async (ctx) => {


    ctx.body = {
      data: leases,
    }
  })*/
}
