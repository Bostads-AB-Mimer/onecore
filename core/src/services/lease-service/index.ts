/**
 * Self-contained service, ready to be extracted into a microservice if appropriate.
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
  getCreditInformation,
  getListingByListingId,
  getListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantByContactCodeAndRentalObjectCode,
  getContactForPhoneNumber,
  withdrawApplicantByManager,
  withdrawApplicantByUser,
  getApplicantsAndListingByContactCode,
  getListingByIdWithDetailedApplicants,
} from '../../adapters/leasing-adapter'

const getLeaseWithRelatedEntities = async (rentalId: string) => {
  const lease = await getLease(rentalId, 'true')

  return lease
}

const getLeasesWithRelatedEntitiesForPnr = async (
  nationalRegistrationNumber: string
) => {
  const leases = await getLeasesForPnr(
    nationalRegistrationNumber,
    undefined,
    'true'
  )

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
   * Returns credit information
   */
  router.get('(.*)/cas/getConsumerReport/:pnr', async (ctx: any) => {
    const responseData = await getCreditInformation(ctx.params.pnr)

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
   * Returns a contact by phone number
   */
  router.get('(.*)/contact/phoneNumber/:pnr', async (ctx: any) => {
    const responseData = await getContactForPhoneNumber(ctx.params.pnr)

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
   * Returns a listing with the provided listing id
   */
  router.get('(.*)/listing/:id', async (ctx) => {
    const responseData = await getListingByListingId(ctx.params.id)

    ctx.body = responseData
  })

  /**
   * Get all Listings with Applicants
   */
  router.get('/listings-with-applicants', async (ctx: any) => {
    const responseData = await getListingsWithApplicants()

    ctx.body = responseData
  })

  /**
   * Get all Applicants by contact code
   */
  router.get('/applicants/:contactCode', async (ctx: any) => {
    const responseData = await getApplicantsByContactCode(
      ctx.params.contactCode
    )

    ctx.body = responseData
  })

  /**
   * Get all Applicants and related Listing by contact code
   */
  router.get('/applicants-with-listings/:contactCode', async (ctx: any) => {
    const responseData = await getApplicantsAndListingByContactCode(
      ctx.params.contactCode
    )

    ctx.body = responseData
  })

  /**
   * Gets a listing with detailed applicant data
   */
  router.get('/listing/:listingId/applicants/details', async (ctx: any) => {
    const responseData = await getListingByIdWithDetailedApplicants(
      ctx.params.listingId
    )

    ctx.body = responseData
  })

  /**
   * Get Applicant by contact code and rental object code
   */
  router.get('/applicants/:contactCode/:rentalObjectCode', async (ctx: any) => {
    const { contactCode, rentalObjectCode } = ctx.params
    const responseData = await getApplicantByContactCodeAndRentalObjectCode(
      contactCode,
      rentalObjectCode
    )

    ctx.body = responseData
  })

  router.delete('/applicants/:applicantId/by-manager', async (ctx) => {
    const responseData = await withdrawApplicantByManager(
      ctx.params.applicantId
    )
    if (responseData.error) {
      ctx.status = 500 // Internal Server Error
      ctx.body = { error: responseData.error }
    } else {
      ctx.status = 200 // OK
      ctx.body = { message: 'Applicant successfully withdrawn by manager.' }
    }
  })

  router.delete(
    '/applicants/:applicantId/by-user/:contactCode',
    async (ctx) => {
      const responseData = await withdrawApplicantByUser(
        ctx.params.applicantId,
        ctx.params.contactCode
      )
      if (responseData.error) {
        ctx.status = 500 // Internal Server Error
        ctx.body = { error: responseData.error }
      } else {
        ctx.status = 200 // OK
        ctx.body = { message: 'Applicant successfully withdrawn by user.' }
      }
    }
  )
}
