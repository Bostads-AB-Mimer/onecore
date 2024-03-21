/**
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'

import {
  getContactByContactCode,
  getContactByNationalRegistrationNumber,
  getLease,
  getLeasesForContactCode,
  getLeasesForNationalRegistrationNumber,
  createListing,
  createApplication,
  removeApplicationByListingId
} from './adapters/tenant-lease-adapter'
import { createLease } from './adapters/xpand-soap-adapter'
import { getInvoicesByContactCode, getUnpaidInvoicesByContactCode } from './adapters/invoices-adapter'
import { Applicant, Listing } from 'onecore-types'

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
  router.get('(.*)/leases/for/nationalRegistrationNumber/:pnr', async (ctx) => {
    const responseData = await getLeasesForNationalRegistrationNumber(
      ctx.params.pnr,
      ctx.query.includeTerminatedLeases
    )

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns leases for a contact code with populated sub objects
   */
  router.get('(.*)/leases/for/contactCode/:pnr', async (ctx) => {
    const responseData = await getLeasesForContactCode(
      ctx.params.pnr,
      ctx.query.includeTerminatedLeases
    )

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

  //todo: determine if this endpoint is needed
  //todo: getting ALL contracts is not feasible in the xpand context
  //todo: passing a list of ids is not really suitable as query params?
  //todo: koa-querystring lib could solve the above problem
  /**
   * Returns all leases with populated sub objects
   */
  // router.get('(.*)/leases', async (ctx) => {
  //   const leases = await getLeases(leaseIds)
  //
  //   ctx.body = {
  //     data: leases,
  //   }
  // })

  /**
   * Gets a person by national registration number.
   */
  router.get(
    '(.*)/contact/nationalRegistrationNumber/:pnr',
    async (ctx: any) => {
      const responseData = await getContactByNationalRegistrationNumber(
        ctx.params.pnr,
        ctx.query.includeTerminatedLeases
      )

      ctx.body = {
        data: responseData,
      }
    }
  )

  /**
   * Gets a person by contact code.
   */
  router.get('(.*)/contact/contactCode/:contactCode', async (ctx: any) => {
    const responseData = await getContactByContactCode(
      ctx.params.contactCode,
      ctx.query.includeTerminatedLeases
    )

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Gets all invoices for a contact, filtered on paid and unpaid.
   */
  router.get('(.*)/contact/invoices/contactCode/:contactCode', async (ctx: any) => {
    const responseData = await getInvoicesByContactCode(
      ctx.params.contactCode,
    )

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Gets the detailed status of a persons unpaid invoices.
   */
  router.get('(.*)/contact/unpaidInvoices/contactCode/:contactCode', async (ctx: any) => {
    const responseData = await getUnpaidInvoicesByContactCode(
      ctx.params.contactCode,
    )

    ctx.body = {
      data: responseData,
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
  })

  /**
   * Creates a new listing.
   */
  router.post('(.*)/listings', async (ctx) => {
    try {
      const listingData = <Listing>ctx.request.body;
      const listingId = await createListing(listingData);

      ctx.status = 201; // HTTP status code for Created
      ctx.body = { listingId };
    } catch (error) {
      ctx.status = 500; // Internal Server Error

      if (error instanceof Error) {
        ctx.body = { error: error.message };
      } else {
        ctx.body = { error: 'An unexpected error occurred.' };
      }
    }
  })

  /**
   * Endpoint to apply for a listing.
   */
  router.post('(.*)/listings/apply', async (ctx) => {
    try {
      // Validate applicationData here

      const applicantData = <Applicant>ctx.request.body;
      const applicationId = await createApplication(applicantData);

      ctx.status = 201; // HTTP status code for Created
      ctx.body = { applicationId };
    } catch (error) {
      ctx.status = 500; // Internal Server Error

      if (error instanceof Error) {
        ctx.body = { error: error.message };
      } else {
        ctx.body = { error: 'An unexpected error occurred.' };
      }
    }
  })

  router.delete('/listings/application/:listingId', async (ctx) => {
    try {
      const { listingId } = ctx.params;
  
      await removeApplicationByListingId(listingId);
      ctx.status = 200; // Successfully deleted
      ctx.body = { message: 'Application removed successfully.' };
    } catch (error) {
      ctx.status = 500; // Internal Server Error
  
      if (error instanceof Error) {
        ctx.body = { error: error.message };
      } else {
        ctx.body = { error: 'An unexpected error occurred.' };
      }
    }
  });
  

}
