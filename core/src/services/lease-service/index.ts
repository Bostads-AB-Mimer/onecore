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

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Lease service
 *     description: Operations related to leases
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/for/{pnr}:
   *   get:
   *     summary: Get leases with related entities for a specific Personal Number (PNR)
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch leases for.
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/leases/for/:pnr', async (ctx) => {
    const responseData = await getLeasesWithRelatedEntitiesForPnr(
      ctx.params.pnr
    )

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * @swagger
   * /cas/getConsumerReport/{pnr}:
   *   get:
   *     summary: Get consumer report for a specific Personal Number (PNR)
   *     tags:
   *       - Lease service
   *     description: Retrieves credit information and consumer report for the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch credit information for.
   *     responses:
   *       '200':
   *         description: Successful response with credit information and consumer report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/cas/getConsumerReport/:pnr', async (ctx) => {
    const responseData = await getCreditInformation(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * @swagger
   * /contact/{pnr}:
   *   get:
   *     summary: Get contact information for a specific Personal Number (PNR)
   *     tags:
   *       - Lease service
   *     description: Retrieves contact information associated with the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch contact information for.
   *     responses:
   *       '200':
   *         description: Successful response with contact information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/contact/:pnr', async (ctx) => {
    const responseData = await getContactForPnr(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * @swagger
   * /contacts/{contactCode}/offers:
   *   get:
   *     summary: Get offers for a contact
   *     tags:
   *       - Lease service
   *     description: Retrieves all offers associated with a specific contact based on the provided contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique code identifying the contact.
   *     responses:
   *       '200':
   *         description: Successful response with a list of offers for the contact.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       '404':
   *         description: The contact was not found.
   *       '500':
   *         description: Internal server error. Failed to retrieve offers.
   *     security:
   *       - bearerAuth: []
   */

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

  /**
   * @swagger
   * /contacts/search:
   *   get:
   *     summary: Search contacts by PNR or contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves contacts based on the provided search query.
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: The search query to filter contacts.
   *     responses:
   *       '200':
   *         description: Successful response with search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       '400':
   *         description: Bad request. The query parameter 'q' must be a string.
   *       '500':
   *         description: Internal server error. Failed to retrieve contacts.
   *     security:
   *       - bearerAuth: []
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

  /**
   * @swagger
   * /contact/contactCode/{contactCode}:
   *   get:
   *     summary: Get contact by contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves a contact based on the provided contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code used to identify the contact.
   *     responses:
   *       '200':
   *         description: Successful response with the requested contact
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
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
   * @swagger
   * /contact/phoneNumber/{pnr}:
   *   get:
   *     summary: Get contact by phone number
   *     tags:
   *       - Lease service
   *     description: Retrieves a contact based on the provided phone number.
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: The phone number used to identify the contact.
   *     responses:
   *       '200':
   *         description: Successful response with the requested contact
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/contact/phoneNumber/:pnr', async (ctx) => {
    const responseData = await getContactForPhoneNumber(ctx.params.pnr)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * @swagger
   * /leases/{id}:
   *   get:
   *     summary: Get lease by ID
   *     tags:
   *       - Lease service
   *     description: Retrieves lease details along with related entities based on the provided ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease to retrieve.
   *     responses:
   *       '200':
   *         description: Successful response with the requested lease and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/leases/:id', async (ctx) => {
    const responseData = await getLeaseWithRelatedEntities(ctx.params.id)

    ctx.body = {
      data: responseData,
    }
  })

  /**
   * @swagger
   * /listing/{id}:
   *   get:
   *     summary: Get listing by ID
   *     tags:
   *       - Lease service
   *     description: Retrieves details of a listing based on the provided ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the listing to retrieve.
   *     responses:
   *       '200':
   *         description: Successful response with the requested listing details.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/listing/:id', async (ctx) => {
    const responseData = await getListingByListingId(ctx.params.id)

    ctx.body = responseData
  })

  /**
   * @swagger
   * /listings-with-applicants:
   *   get:
   *     summary: Get listings with applicants
   *     tags:
   *       - Lease service
   *     description: Retrieves a list of listings along with their associated applicants.
   *     responses:
   *       '200':
   *         description: Successful response with listings and their applicants.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       '500':
   *         description: Internal server error. Failed to retrieve listings with applicants.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/listings-with-applicants', async (ctx) => {
    const responseData = await getListingsWithApplicants()

    ctx.body = responseData
  })

  /**
   * @swagger
   * /listings/{listingId}/offers:
   *   post:
   *     summary: Create an offer for a listing
   *     tags:
   *       - Lease service
   *     description: Creates an offer for the specified listing.
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the listing to create an offer for.
   *     responses:
   *       '201':
   *         description: Offer creation successful.
   *       '500':
   *         description: Internal server error. Failed to create the offer.
   *     security:
   *       - bearerAuth: []
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
   * @swagger
   * /applicants/{contactCode}:
   *   get:
   *     summary: Get applicants by contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves applicants based on the contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code used to fetch applicants.
   *     responses:
   *       '200':
   *         description: Successful retrieval of applicants.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/applicants/:contactCode', async (ctx) => {
    const responseData = await getApplicantsByContactCode(
      ctx.params.contactCode
    )

    ctx.body = responseData
  })

  /**
   * @swagger
   * /applicants-with-listings/{contactCode}:
   *   get:
   *     summary: Get applicants with listings by contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves applicants along with their listings based on the contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code used to fetch applicants and their associated listings.
   *     responses:
   *       '200':
   *         description: Successful retrieval of applicants with their listings.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/applicants-with-listings/:contactCode', async (ctx) => {
    const responseData = await getApplicantsAndListingByContactCode(
      ctx.params.contactCode
    )

    ctx.body = responseData
  })

  /**
   * @swagger
   * /listing/{listingId}/applicants/details:
   *   get:
   *     summary: Get listing by ID with detailed applicants
   *     tags:
   *       - Lease service
   *     description: Retrieves a listing by ID along with detailed information about its applicants.
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the listing to fetch along with detailed applicant information.
   *     responses:
   *       '200':
   *         description: Successful retrieval of the listing with detailed applicant information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/listing/:listingId/applicants/details', async (ctx) => {
    const responseData = await getListingByIdWithDetailedApplicants(
      ctx.params.listingId
    )

    ctx.body = responseData
  })

  /**
   * @swagger
   * /applicants/{contactCode}/{listingId}:
   *   get:
   *     summary: Get applicant by contact code and listing ID
   *     tags:
   *       - Lease service
   *     description: Retrieves an applicant by their contact code and listing ID.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicant.
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the listing associated with the applicant.
   *     responses:
   *       '200':
   *         description: Successful retrieval of the applicant.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/applicants/:contactCode/:listingId', async (ctx) => {
    const { contactCode, listingId } = ctx.params
    const responseData = await getApplicantByContactCodeAndListingId(
      contactCode,
      listingId
    )

    ctx.body = responseData
  })

  /**
   * @swagger
   * /applicants/{applicantId}/by-manager:
   *   delete:
   *     summary: Withdraw applicant by manager
   *     tags:
   *       - Lease service
   *     description: Withdraws an applicant by the manager using the applicant ID.
   *     parameters:
   *       - in: path
   *         name: applicantId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the applicant to be withdrawn.
   *     responses:
   *       '200':
   *         description: Successful withdrawal of the applicant by manager.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Applicant successfully withdrawn by manager.
   *       '500':
   *         description: Internal server error. Failed to withdraw the applicant.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Error message describing the issue.
   *     security:
   *       - bearerAuth: []
   */
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

  /**
   * @swagger
   * /applicants/{applicantId}/by-user/{contactCode}:
   *   delete:
   *     summary: Withdraw applicant by user
   *     tags:
   *       - Lease service
   *     description: Withdraws an applicant by the user identified by contact code and applicant ID.
   *     parameters:
   *       - in: path
   *         name: applicantId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the applicant to be withdrawn.
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the user initiating the withdrawal.
   *     responses:
   *       '200':
   *         description: Successful withdrawal of the applicant by user.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Applicant successfully withdrawn by user.
   *       '500':
   *         description: Internal server error. Failed to withdraw the applicant.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Error message describing the issue.
   *     security:
   *       - bearerAuth: []
   */
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
