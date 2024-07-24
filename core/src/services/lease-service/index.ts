/**
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger } from 'onecore-utilities'

import {
  getLease,
  getLeasesForPnr,
  getCreditInformation,
  getListingByListingId,
  getListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantByContactCodeAndListingId,
  getContactForPhoneNumber,
  withdrawApplicantByManager,
  withdrawApplicantByUser,
  getApplicantsAndListingByContactCode,
  getListingByIdWithDetailedApplicants,
  getOffersForContact,
  getContactsDataBySearchQuery,
  getContactByContactCode,
  getContactForPnr,
} from '../../adapters/leasing-adapter'
import { ProcessStatus } from '../../common/types'
import { createOfferForInternalParkingSpace } from '../../processes/parkingspaces/internal'

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
  router.get('(.*)/cas/getConsumerReport/:pnr', async (ctx) => {
    const responseData = await getCreditInformation(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns a contact by national registration number
   */
  router.get('(.*)/contact/:pnr', async (ctx) => {
    const responseData = await getContactForPnr(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * Returns all offers for a contact by contactCode
   */
  //todo: write swagger docs
  router.get('(.*)/contacts/:contactCode/offers', async (ctx) => {
    const res = await getOffersForContact(ctx.params.contactCode)
    if (!res.ok) {
      ctx.status = res.err === 'not-found' ? 404 : 500
      return
    }

    ctx.status = 200
    ctx.body = {
      data: res.data,
    }
  })
  /*
   * Returns a list of contacts by search query (natregnumber or contact code)
   */
  router.get('(.*)/contacts/search', async (ctx) => {
    if (typeof ctx.query.q !== 'string') {
      ctx.status = 400
      return
    }

    const result = await getContactsDataBySearchQuery(ctx.query.q)

    if (!result.ok) {
      ctx.status = 500
    } else {
      ctx.status = 200
      ctx.body = { data: result.data }
    }
  })

  router.get('(.*)/contact/contactCode/:contactCode', async (ctx) => {
    const res = await getContactByContactCode(ctx.params.contactCode)
    if (!res.ok) {
      ctx.status = res.err === 'not-found' ? 404 : 500
      return
    }

    ctx.status = 200
    ctx.body = {
      data: res.data,
    }
  })

  /**
   * Returns a contact by phone number
   */
  router.get('(.*)/contact/phoneNumber/:pnr', async (ctx) => {
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
  router.get('/listings-with-applicants', async (ctx) => {
    const responseData = await getListingsWithApplicants()

    ctx.body = responseData
  })

  /**
   * Create Offer for a listing
   */
  router.post('(.*)/listings/:listingId/offers', async (ctx) => {
    const result = await createOfferForInternalParkingSpace(
      ctx.params.listingId
    )

    if (result.processStatus === ProcessStatus.successful) {
      logger.info(result)
      ctx.status = 201
      return
    }

    ctx.status = 500

    // Step 6: Communicate error to dev team and customer service
  })

  /**
   * Get all Applicants by contact code
   */
  router.get('/applicants/:contactCode', async (ctx) => {
    const responseData = await getApplicantsByContactCode(
      ctx.params.contactCode
    )

    ctx.body = responseData
  })

  /**
   * Get all Applicants and related Listing by contact code
   */
  router.get('/applicants-with-listings/:contactCode', async (ctx) => {
    const responseData = await getApplicantsAndListingByContactCode(
      ctx.params.contactCode
    )

    ctx.body = responseData
  })

  /**
   * Gets a listing with detailed applicant data
   */
  router.get('/listing/:listingId/applicants/details', async (ctx) => {
    const responseData = await getListingByIdWithDetailedApplicants(
      ctx.params.listingId
    )

    ctx.body = responseData
  })

  /**
   * Get Applicant by contact code and listing id
   */
  router.get('/applicants/:contactCode/:listingId', async (ctx) => {
    const { contactCode, listingId } = ctx.params
    const responseData = await getApplicantByContactCodeAndListingId(
      contactCode,
      listingId
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
