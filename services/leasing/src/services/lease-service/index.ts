/**
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { Contact } from 'onecore-types'

import {
  getLease,
  getLeases,
  getLeasesFor,
  getContact,
  updateContact,
  updateContacts,
} from './adapters/tenant-lease-adapter'
import { createLease } from './adapters/xpand-soap-adapter'

interface CreateLeaseRequest {
  parkingSpaceId: string
  contactCode: string
  fromDate: string
  companyCode: string
}

export const routes = (router: KoaRouter) => {
  /**
   * Returns leases for a national registration number with populated sub objects
   */
  router.get('(.*)/leases/for/:pnr', async (ctx) => {
    const responseData = await getLeasesFor(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

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

  /**
   * Gets a person.
   */

  router.get('(.*)/contact/:pnr', async (ctx: any) => {
    const responseData = await getContact(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })
  /**
   * Creates or updates a person.
   */
  router.post('(.*)/contacts', async (ctx) => {
    if (Array.isArray(ctx.request.body)) {
      await updateContacts(ctx.request.body as Contact[])
    } else {
      await updateContact(ctx.request.body as Contact)
    }

    ctx.body = {
      meta: 'tbd',
    }
  })

  /**
   * Creates or updates a lease.
   */
  router.post('(.*)/leases', async (ctx) => {
    try {
      const request = <CreateLeaseRequest>ctx.request.body

      const newLeaseId = await createLease(
        new Date(request.fromDate),
        request.parkingSpaceId,
        request.contactCode,
        request.companyCode
      )
      ctx.body = {
        LeaseId: newLeaseId,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
        }
      }
    }
    // if (Array.isArray(ctx.request.body)) {
    //   await updateLeases(ctx.request.body as Lease[])
    // } else {
    //   await updateLease(ctx.request.body as Lease)
    // }

    // ctx.body = {
    //   meta: 'tbd',
    // }
  })
}
