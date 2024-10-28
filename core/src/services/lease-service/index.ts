/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { GetActiveOfferByListingIdErrorCodes } from 'onecore-types'
import { logger, generateRouteMetadata } from 'onecore-utilities'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { ProcessStatus } from '../../common/types'
import * as internalParkingSpaceProcesses from '../../processes/parkingspaces/internal'

const getLeaseWithRelatedEntities = async (rentalId: string) => {
  const lease = await leasingAdapter.getLease(rentalId, 'true')

  return lease
}

const getLeasesWithRelatedEntitiesForPnr = async (
  nationalRegistrationNumber: string
) => {
  const leases = await leasingAdapter.getLeasesForPnr(
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getLeasesWithRelatedEntitiesForPnr(
      ctx.params.pnr
    )

    ctx.body = {
      content: responseData,
      ...metadata,
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.getCreditInformation(
      ctx.params.pnr
    )

    ctx.body = {
      content: responseData,
      ...metadata,
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.getContactForPnr(ctx.params.pnr)

    ctx.body = {
      content: responseData,
      ...metadata,
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
    const metadata = generateRouteMetadata(ctx)
    const res = await leasingAdapter.getOffersForContact(ctx.params.contactCode)
    if (!res.ok) {
      if (res.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'not-found', ...metadata }
        return
      } else {
        ctx.status = 500
        ctx.body = { error: res.err, ...metadata }
        return
      }
    }

    ctx.status = 200
    ctx.body = {
      content: res.data,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /offers/{offerId}/applicants/{contactCode}:
   *   get:
   *     summary: Get a specific offer for an applicant
   *     description: Retrieve details of a specific offer associated with an applicant using contact code and offer ID.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the offer.
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique code identifying the applicant.
   *     responses:
   *       200:
   *         description: Details of the specified offer.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Offer not found for the specified contact code and offer ID.
   *       '500':
   *         description: Internal server error. Failed to retrieve the offer.
   *     security:
   *       - bearerAuth: []
   */

  router.get('(.*)/offers/:offerId/applicants/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const res = await leasingAdapter.getOfferByContactCodeAndOfferId(
      ctx.params.contactCode,
      ctx.params.offerId
    )
    if (!res.ok) {
      ctx.status = res.err === 'not-found' ? 404 : 500
      ctx.body = { error: res.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: res.data,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /offers/listing-id/{listingId}:
   *   get:
   *     summary: Get offers for a specific listing
   *     description: Get all offers for a listing.
   *     tags: [Offer]
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: integer
   *         description: The unique ID of the listing.
   *     responses:
   *       200:
   *         description: A list of offers.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Internal server error.
   */
  router.get('/offers/listing-id/:listingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getOffersByListingId(
      Number.parseInt(ctx.params.listingId)
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /offers/listing-id/{listingId}:
   *   get:
   *     summary: Gets active offer for a specific listing
   *     description: Get an offer for a listing.
   *     tags: [Offer]
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: integer
   *         description: The unique ID of the listing.
   *     responses:
   *       200:
   *         description: The active offer.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: Internal server error.
   */
  router.get('/offers/listing-id/:listingId/active', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getActiveOfferByListingId(
      Number.parseInt(ctx.params.listingId)
    )

    if (!result.ok) {
      if (result.err === GetActiveOfferByListingIdErrorCodes.NotFound) {
        ctx.status = result.statusCode ?? 404
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = result.statusCode ?? 200
    ctx.body = { content: result.data, ...metadata }
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
    const metadata = generateRouteMetadata(ctx, ['q'])
    if (typeof ctx.query.q !== 'string') {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameter', ...metadata }
      return
    }

    const res = await leasingAdapter.getContactsDataBySearchQuery(ctx.query.q)

    if (!res.ok) {
      ctx.status = 500
      ctx.body = { error: res.err, ...metadata }
    } else {
      ctx.status = 200
      ctx.body = { content: res.data, ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const res = await leasingAdapter.getContactByContactCode(
      ctx.params.contactCode
    )

    if (!res.ok) {
      if (res.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'not-found', ...metadata }
        return
      } else {
        ctx.status = 500
        ctx.body = { error: res.err, ...metadata }
        return
      }
    }

    ctx.status = 200
    ctx.body = {
      content: res.data,
      ...metadata,
    }
  })

  router.get('(.*)/tenants/contactCode/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const res = await leasingAdapter.getTenantByContactCode(
      ctx.params.contactCode
    )

    if (!res.ok) {
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: res.data,
      ...metadata,
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.getContactByPhoneNumber(
      ctx.params.pnr
    )

    ctx.body = {
      content: responseData,
      ...metadata,
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getLeaseWithRelatedEntities(ctx.params.id)

    ctx.body = {
      content: responseData,
      ...metadata,
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.getListingByListingId(
      Number.parseInt(ctx.params.id)
    )

    ctx.body = { content: responseData, ...metadata }
  })

  /**
   * @swagger
   * /listings-with-applicants:
   *   get:
   *     summary: Get listings with applicants
   *     tags:
   *       - Lease service
   *     description: Retrieves a list of listings along with their associated applicants.
   *     parameters:
   *       - in: query
   *         name: type
   *         required: false
   *         schema:
   *           type: string
   *           enum: [published, ready-for-offer, offered, historical]
   *         description: Filters listings by one of the above types. Must be one of the specified values.
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
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getListingsWithApplicants(
      ctx.querystring
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: 'Unknown error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const result =
      await internalParkingSpaceProcesses.createOfferForInternalParkingSpace(
        Number.parseInt(ctx.params.listingId)
      )

    if (result.processStatus === ProcessStatus.successful) {
      logger.info(result)
      ctx.status = 201
      ctx.body = { message: 'Offer created successfully', ...metadata }
      return
    }

    ctx.status = 500
    ctx.body = { error: result.error, ...metadata }

    // Step 6: Communicate error to dev team and customer service
  })

  /**
   * @swagger
   * /offers/{offerId}/accept:
   *   post:
   *     summary: Accept an offer
   *     tags:
   *       - Lease service
   *     description: Accepts an offer for the contact of the contactCode provided
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the offer to accept
   *     responses:
   *       '202':
   *         description: Offer accepted successful.
   *       '500':
   *         description: Internal server error. Failed to accept the offer.
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/offers/:offerId/accept', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await internalParkingSpaceProcesses.acceptOffer(
      parseInt(ctx.params.offerId)
    )

    if (result.processStatus === ProcessStatus.successful) {
      logger.info(result)
      ctx.status = 202
      ctx.body = { message: 'Offer accepted successfully', ...metadata }
      return
    }

    ctx.status = result.httpStatus
    ctx.body = { error: result.error, ...metadata }
  })

  /**
   * @swagger
   * /offers/{offerId}/deny:
   *   post:
   *     summary: Deny an offer
   *     tags:
   *       - Lease service
   *     description: Denies an offer
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the offer to deny
   *     responses:
   *       '202':
   *         description: Offer denied successful.
   *       '500':
   *         description: Internal server error. Failed to deny the offer.
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/offers/:offerId/deny', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const denyOffer = await internalParkingSpaceProcesses.denyOffer(
      Number.parseInt(ctx.params.offerId)
    )

    if (denyOffer.processStatus !== ProcessStatus.successful) {
      ctx.status = denyOffer.httpStatus
      ctx.body = { error: denyOffer.error, ...metadata }
      return
    }

    //do not await since the process is responsible to handle the new offer
    internalParkingSpaceProcesses.createOfferForInternalParkingSpace(
      denyOffer.data.listingId
    )

    ctx.status = 202
    ctx.body = { message: 'Offer denied successfully', ...metadata }
  })

  /**
   * @swagger
   * /offers/{offerId}/expire:
   *   get:
   *     summary: Expire an offer
   *     tags:
   *       - Lease service
   *     description: Expires an offer
   *     parameters:
   *       - in: path
   *         name: offerId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the offer to expire
   *     responses:
   *       '202':
   *         description: Offer expired successful.
   *       '500':
   *         description: Internal server error. Failed to expire the offer.
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/offers/:offerId/expire', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await internalParkingSpaceProcesses.expireOffer(
      parseInt(ctx.params.offerId)
    )

    if (result.processStatus === ProcessStatus.successful) {
      logger.info(result)
      ctx.status = 202
      ctx.body = { message: 'Offer expired successfully', ...metadata }
      return
    }

    ctx.status = 500
    ctx.body = { error: result.error, ...metadata }
  })

  /**
   * @swagger
   * /listings/sync-internal-from-xpand:
   *   post:
   *     summary: Sync internal parking spaces from xpand to onecores database
   *     tags:
   *       - Lease service
   *     description:
   *     responses:
   *       '200':
   *         description: Request ok.
   *       '500':
   *         description: Internal server error. Failed to sync internal parking spaces.
   *     security:
   *       - bearerAuth: []
   */
  router.post('/listings/sync-internal-from-xpand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.syncInternalParkingSpacesFromXpand()

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: 'Unknown error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.getApplicantsByContactCode(
      ctx.params.contactCode
    )

    ctx.body = { content: responseData, ...metadata }
  })
  /**
   * @swagger
   * /applicants/validate-rental-rules/property/{contactCode}/{rentalObjectCode}:
   *   get:
   *     summary: Validate property rental rules for applicant
   *     description: Validate property rental rules for an applicant based on contact code and listing ID.
   *     tags: [Applicants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicant.
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: integer
   *         description: The xpand rental object code of the property.
   *     responses:
   *       200:
   *         description: No property rental rules apply to this property.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 applicationType: string
   *                 example: Additional - applicant is eligible for applying for an additional parking space. Replace - applicant is eligible for replacing their current parking space in the same residential area or property.
   *                 reason:
   *                   type: string
   *                   example: No property rental rules applies to this property.
   *       400:
   *         description: Rental object code is not a parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Rental object code entity is not a parking space.
   *       403:
   *         description: Applicant is not eligible for the property based on property rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     notTenant:
   *                       value: Applicant is not a current or coming tenant in the property.
   *                     noParkingContracts:
   *                       value: User does not have any active parking space contracts in the property residential area.
   *       404:
   *         description: Listing, property info, or applicant not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     listingNotFound:
   *                       value: Listing was not found.
   *                     propertyInfoNotFound:
   *                       value: Property info for listing was not found.
   *                     applicantNotFound:
   *                       value: Applicant was not found.
   *                     contactCodeMismatch:
   *                       value: Applicant not found for this contactCode.
   *       500:
   *         description: An error occurred while validating property rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while validating property rental rules.
   */
  router.get(
    '(.*)/applicants/validate-rental-rules/property/:contactCode/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const res = await leasingAdapter.validatePropertyRentalRules(
        ctx.params.contactCode,
        ctx.params.rentalObjectCode
      )

      if (!res.ok) {
        if (res.err.tag === 'not-tenant-in-the-property') {
          ctx.status = 403
          ctx.body = { reason: res.err.data, ...metadata }
          return
        }

        if (res.err.tag === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: res.err.data, ...metadata }
          return
        }

        if (res.err.tag === 'not-a-parking-space') {
          ctx.status = 400
          ctx.body = { reason: res.err.data, ...metadata }
          return
        }

        ctx.status = 500
        ctx.body = { error: 'An internal server error occured.', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: res.data,
        ...metadata,
      }
    }
  )
  /**
   * @swagger
   * /applicants/validate-rental-rules/residential-area/{contactCode}/{districtCode}:
   *   get:
   *     summary: Validate residential area rental rules for applicant
   *     description: Validate residential area rental rules for an applicant based on contact code and district code.
   *     tags: [Applicants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the applicant.
   *       - in: path
   *         name: districtCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The xpand district code of the residential area to validate against.
   *     responses:
   *       200:
   *         description: Either no residential area rental rules apply or applicant is eligible to apply for parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 applicationType: string
   *                 example: Additional - applicant is eligible for applying for an additional parking space. Replace - applicant is eligible for replacing their current parking space in the same residential area or property.
   *                 reason:
   *                   type: string
   *                   examples:
   *                     noRules:
   *                       value: No residential area rental rules applies to this listing.
   *                     eligible:
   *                       value: Applicant does not have any active parking space contracts in the listings residential area. Applicant is eligible to apply to parking space.
   *       403:
   *         description: Applicant is not eligible for the listing based on residential area rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Applicant does not have any current or upcoming housing contracts in the residential area.
   *       404:
   *         description: Listing or applicant not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   examples:
   *                     listingNotFound:
   *                       value: Listing was not found.
   *                     applicantNotFound:
   *                       value: Applicant was not found.
   *       500:
   *         description: An error occurred while validating residential area rental rules.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: An error occurred while validating residential area rental rules.
   */
  router.get(
    '(.*)/applicants/validate-rental-rules/residential-area/:contactCode/:districtCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const res = await leasingAdapter.validateResidentialAreaRentalRules(
        ctx.params.contactCode,
        ctx.params.districtCode
      )

      if (!res.ok) {
        if (res.err.tag === 'no-housing-contract-in-the-area') {
          ctx.status = 403
          ctx.body = { reason: res.err.data, ...metadata }
          return
        }

        if (res.err.tag === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: res.err.data, ...metadata }
          return
        }

        ctx.status = 500
        ctx.body = { error: 'An internal server error occured.', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: res.data,
        ...metadata,
      }
    }
  )

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
    const metadata = generateRouteMetadata(ctx)
    const responseData =
      await leasingAdapter.getApplicantsAndListingByContactCode(
        ctx.params.contactCode
      )

    ctx.body = { content: responseData, ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getDetailedApplicantsByListingId(
      Number(ctx.params.listingId)
    )

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Listing not found', ...metadata }
        return
      } else {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /listings/{listingId}:
   *   delete:
   *     summary: Delete a Listing by ID
   *     description: Deletes a listing by it's ID.
   *     tags:
   *       - Listings
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: number
   *         description: ID of the listing to delete.
   *     responses:
   *       '200':
   *         description: Successfully deleted listing.
   *       '409':
   *         description: Conflict.
   *       '500':
   *         description: Internal server error.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.delete('(.*)/listings/:listingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.deleteListing(
      Number(ctx.params.listingId)
    )

    if (!result.ok) {
      if (result.err.tag === 'conflict') {
        ctx.status = 409
        ctx.body = { reason: result.err, ...metadata }
        return
      }

      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const { contactCode, listingId } = ctx.params
    const responseData =
      await leasingAdapter.getApplicantByContactCodeAndListingId(
        contactCode,
        listingId
      )

    ctx.body = { content: responseData, ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.withdrawApplicantByManager(
      ctx.params.applicantId
    )

    if (responseData.error) {
      ctx.status = 500 // Internal Server Error
      ctx.body = { error: responseData.error, ...metadata }
    } else {
      ctx.status = 200 // OK
      ctx.body = {
        message: 'Applicant successfully withdrawn by manager.',
        ...metadata,
      }
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
      const metadata = generateRouteMetadata(ctx)
      const responseData = await leasingAdapter.withdrawApplicantByUser(
        ctx.params.applicantId,
        ctx.params.contactCode
      )

      if (responseData.error) {
        ctx.status = 500 // Internal Server Error
        ctx.body = { error: responseData.error, ...metadata }
      } else {
        ctx.status = 200 // OK
        ctx.body = {
          message: 'Applicant successfully withdrawn by user.',
          ...metadata,
        }
      }
    }
  )
}
