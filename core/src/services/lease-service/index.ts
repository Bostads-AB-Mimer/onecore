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
  getListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantByContactCodeAndRentalObjectCode,
  getContactForPhoneNumber,
} from '../../adapters/leasing-adapter'

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
}
