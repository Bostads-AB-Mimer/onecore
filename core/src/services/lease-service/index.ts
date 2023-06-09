/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { getLease } from './adapters/tenant-lease-adapter'
import { getApartment } from './adapters/apartment-adapter'
import { Lease } from '../../common/types'

const getLeaseWithRelatedEntities = async (rentalId: string) => {
  const lease = await getLease(rentalId)
  lease.apartment = await getApartment(lease.apartmentId, lease.leaseId)
  lease.apartment.addressId = lease.tenants?.[0].address?.addressId ?? '123'
  lease.apartment.address = lease.tenants?.[0].address

  return lease
}

export const routes = (router: KoaRouter) => {
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
  router.get('(.*)/leases', async (ctx) => {
    const numberOfLeases = Math.round((Math.random() + 0.1) * 10)
    const leases: Lease[] = []
    for (var i = 0; i < numberOfLeases; i++) {
      leases.push(
        await getLeaseWithRelatedEntities(
          Math.round(Math.random() * 100000).toString()
        )
      )
    }

    ctx.body = {
      data: leases,
    }
  })
}
