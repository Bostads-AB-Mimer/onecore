/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import dayjs from 'dayjs'
import {
  GetActiveOfferByListingIdErrorCodes,
  RouteErrorResponse,
} from '@onecore/types'
import { logger, generateRouteMetadata } from '@onecore/utilities'
import { z } from 'zod'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../adapters/property-management-adapter'
import { ProcessStatus } from '../../common/types'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import * as internalParkingSpaceProcesses from '../../processes/parkingspaces/internal'
import { makeAdminApplicationProfileRequestParams } from './helpers/application-profile'
import { schemas } from './schemas'
import { isAllowedNumResidents } from './services/is-allowed-num-residents'

import { routes as applicationProfileRoutesOld } from './application-profile-old'
import { routes as listings } from './listings'
import { routes as commentsRoutes } from './comments'
import { routes as rentalObjectsRoutes } from './rental-objects'

import { registerSchema } from '../../utils/openapi'
import {
  GetLeasesByRentalPropertyIdQueryParams,
  Lease,
  mapLease,
} from './schemas/lease'

const getLeaseWithRelatedEntities = async (rentalId: string) => {
  const lease = await leasingAdapter.getLease(rentalId, 'true')

  return lease
}

const getLeasesWithRelatedEntitiesForPnr = async (
  nationalRegistrationNumber: string
) => {
  const leases = await leasingAdapter.getLeasesForPnr(
    nationalRegistrationNumber,
    {
      includeUpcomingLeases: false,
      includeTerminatedLeases: false,
      includeContacts: true,
    }
  )

  return leases
}

const getLeasesWithRelatedEntitiesForPnrIncludingAllLeases = async (
  nationalRegistrationNumber: string
) => {
  const leases = await leasingAdapter.getLeasesForPnr(
    nationalRegistrationNumber,
    {
      includeUpcomingLeases: true,
      includeTerminatedLeases: true,
      includeContacts: true,
    }
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
  registerSchema('Lease', Lease)

  // TODO: Remove this once all routes are migrated to the new application
  // profile (with housing references)
  applicationProfileRoutesOld(router)

  listings(router)
  commentsRoutes(router)
  rentalObjectsRoutes(router)

  /**
   * @swagger
   * /leases/by-rental-property-id/{rentalPropertyId}:
   *   get:
   *     summary: Get leases with related entities for a specific rental property id
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified rental property id.
   *     parameters:
   *       - in: path
   *         name: rentalPropertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental roperty id of the building/residence to fetch leases for.
   *       - in: query
   *         name: includeUpcomingLeases
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include upcoming leases in the response
   *       - in: query
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include terminated leases in the response
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include contact information in the response
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *       '400':
   *         description: Invalid query parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-rental-property-id/:rentalPropertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = GetLeasesByRentalPropertyIdQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: queryParams.error,
        ...metadata,
      }
      return
    }

    try {
      const leases = await leasingAdapter.getLeasesForPropertyId(
        ctx.params.rentalPropertyId,
        queryParams.data
      )

      ctx.status = 200
      ctx.body = {
        content: leases.map(mapLease),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
    }
  })

  /**
   * @swagger
   * /leases/by-pnr/{pnr}:
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
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *               additionalProperties: true
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-pnr/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getLeasesWithRelatedEntitiesForPnr(
      ctx.params.pnr
    )

    ctx.body = {
      content: responseData.map(mapLease),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/by-pnr/{pnr}/includingAllLeases:
   *   get:
   *     summary: Get all leases (active, upcoming, and terminated) for a PNR
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (tenants, properties, etc.) for the specified PNR. Includes **active**, **upcoming**, and **terminated** leases.
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch leases for.
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *               additionalProperties: true  # accounts for generateRouteMetadata fields
   *       '500':
   *         description: Internal server error.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-pnr/:pnr/includingAllLeases', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData =
      await getLeasesWithRelatedEntitiesForPnrIncludingAllLeases(ctx.params.pnr)

    ctx.status = 200
    ctx.body = {
      content: responseData.map(mapLease),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get leases with related entities for a specific contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Contact code of the individual to fetch leases for.
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Lease'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await leasingAdapter.getLeasesForContactCode(
      ctx.params.contactCode,
      {
        includeUpcomingLeases: false,
        includeTerminatedLeases: false,
        includeContacts: true,
      }
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /consumer-reports/by-pnr/{pnr}:
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
  router.get('/consumer-reports/by-pnr/:pnr', async (ctx) => {
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
   * /contacts/by-pnr/{pnr}:
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
  router.get('/contacts/by-pnr/:pnr', async (ctx) => {
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

  router.get('/contacts/:contactCode/offers', async (ctx) => {
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

  router.get('/offers/:offerId/applicants/:contactCode', async (ctx) => {
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
   * /offers/by-listing-id/{listingId}:
   *   get:
   *     summary: Get offers for a specific listing
   *     description: Get all offers for a listing.
   *     tags:
   *       - Lease service
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
  router.get('/offers/by-listing-id/:listingId', async (ctx) => {
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
   * /offers/by-listing-id/{listingId}/active:
   *   get:
   *     summary: Gets active offer for a specific listing
   *     description: Get an offer for a listing.
   *     tags:
   *       - Lease service
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
  router.get('/offers/by-listing-id/:listingId/active', async (ctx) => {
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
  router.get('/contacts/search', async (ctx) => {
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
   * /contacts/{contactCode}:
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
  router.get('/contacts/:contactCode', async (ctx) => {
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

  /**
   * @swagger
   * /tenants/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get tenant by contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves a tenant based on the provided contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code used to identify the contact.
   *     responses:
   *       200:
   *         description: Successfully retrieved tenant information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The tenant data.
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error. Failed to retrieve Tenant information.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/tenants/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const res = await leasingAdapter.getTenantByContactCode(
      ctx.params.contactCode
    )

    if (!res.ok) {
      if (res.err === 'contact-not-found') {
        ctx.status = 404
        ctx.body = {
          type: res.err,
          title: 'Contact not found',
          status: 404,
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      if (res.err === 'no-valid-housing-contract') {
        ctx.status = 500
        ctx.body = {
          type: res.err,
          title: 'No valid housing contract found',
          status: 500,
          detail: 'No active or upcoming contract found.',
          ...metadata,
        } satisfies RouteErrorResponse

        return
      }

      if (res.err === 'contact-not-tenant') {
        ctx.status = 500
        ctx.body = {
          type: res.err,
          title: 'Contact is not a tenant',
          status: 500,
          detail: 'No active or upcoming contract found.',
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      ctx.status = 500
      ctx.body = {
        type: res.err,
        title: 'Internal server error',
        status: 500,
        ...metadata,
      } satisfies RouteErrorResponse
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
   * /contacts/by-phone-number/{pnr}:
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
  router.get('/contacts/by-phone-number/:pnr', async (ctx) => {
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
   *                 content:
   *                   $ref: '#/components/schemas/Lease'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getLeaseWithRelatedEntities(ctx.params.id)

    ctx.body = {
      content: responseData,
      ...metadata,
    }
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
  router.post('/offers/:offerId/accept', async (ctx) => {
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
  router.post('/offers/:offerId/deny', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const denyOffer = await internalParkingSpaceProcesses.denyOffer(
      Number.parseInt(ctx.params.offerId)
    )

    if (denyOffer.processStatus !== ProcessStatus.successful) {
      ctx.status = denyOffer.httpStatus
      ctx.body = { error: denyOffer.error, ...metadata }
      return
    }

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
  router.get('/offers/:offerId/expire', async (ctx) => {
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
   * /applicants:
   *   get:
   *     summary: Get applicants by contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves applicants based on the contact code.
   *     parameters:
   *       - in: query
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
  const GetApplicantsQueryParams = z.object({ contactCode: z.string() })
  router.get('/applicants', async (ctx) => {
    const queryParams = GetApplicantsQueryParams.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { error: queryParams.error.errors }
      return
    }

    const metadata = generateRouteMetadata(ctx)
    try {
      const responseData = await leasingAdapter.getApplicantsByContactCode(
        queryParams.data.contactCode
      )

      ctx.status = 200
      ctx.body = { content: responseData, ...metadata }
    } catch (err) {
      logger.error(err, 'Error getting applicants by contact code')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /applicants/validate-rental-rules/property/{contactCode}/{rentalObjectCode}:
   *   get:
   *     summary: Validate property rental rules for applicant
   *     description: Validate property rental rules for an applicant based on contact code and listing ID.
   *     tags:
   *       - Lease service
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
   *                 applicationType:
   *                   type: string
   *                   example: Additional - applicant is eligible for applying for an additional parking space. Replace - applicant is eligible for replacing their current parking space in the same residential area or property.
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
    '/applicants/validate-rental-rules/property/:contactCode/:rentalObjectCode',
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
   *     tags:
   *       - Lease service
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
   *                 applicationType:
   *                   type: string
   *                   example: Additional - applicant is eligible for applying for an additional parking space. Replace - applicant is eligible for replacing their current parking space in the same residential area or property.
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
    '/applicants/validate-rental-rules/residential-area/:contactCode/:districtCode',
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
   * /applicants-with-listings/by-contact-code/{contactCode}:
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
  router.get(
    '/applicants-with-listings/by-contact-code/:contactCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const responseData =
        await leasingAdapter.getApplicantsAndListingByContactCode(
          ctx.params.contactCode
        )

      ctx.body = { content: responseData, ...metadata }
    }
  )

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

  /**
   * @swagger
   * /contacts/{contactCode}/application-profile:
   *   get:
   *     summary: Gets an application profile by contact code
   *     description: Retrieve application profile information by contact code.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code associated with the application profile.
   *     responses:
   *       200:
   *         description: Successfully retrieved application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error. Failed to retrieve application profile information.
   */

  router.get('/contacts/:contactCode/application-profile', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const profile = await leasingAdapter.getApplicationProfileByContactCode(
      ctx.params.contactCode
    )

    if (!profile.ok) {
      if (profile.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'not-found', ...metadata }
        return
      }

      ctx.status = 500
      ctx.body = { error: 'unknown', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: profile.data satisfies z.infer<
        typeof schemas.client.applicationProfile.GetApplicationProfileResponseData
      >,

      ...metadata,
    }
  })

  /**
   * @swagger
   * /contacts/{contactCode}/application-profile/admin:
   *   post:
   *     summary: Creates or updates an application profile by contact code
   *     description: Create or update application profile information by contact code.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code associated with the application profile.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *       properties:
   *         numAdults:
   *           type: number
   *           description: Number of adults in the current housing.
   *         numChildren:
   *           type: number
   *           description: Number of children in the current housing.
   *     responses:
   *       200:
   *         description: Successfully updated application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       201:
   *         description: Successfully created application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       500:
   *         description: Internal server error. Failed to update application profile information.
   */

  type UpdateAdminApplicationProfileRequestParams = z.infer<
    typeof schemas.admin.applicationProfile.UpdateApplicationProfileRequestParams
  >

  router.post(
    '/contacts/:contactCode/application-profile/admin',
    parseRequestBody(
      schemas.admin.applicationProfile.UpdateApplicationProfileRequestParams
    ),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      // TODO: Something wrong with parseRequestBody types.
      // Body should be inferred from middleware
      const body = ctx.request
        .body as UpdateAdminApplicationProfileRequestParams

      const getApplicationProfile =
        await leasingAdapter.getApplicationProfileByContactCode(
          ctx.params.contactCode
        )

      if (
        !getApplicationProfile.ok &&
        getApplicationProfile.err !== 'not-found'
      ) {
        ctx.status = 500
        ctx.body = { error: 'unknown', ...metadata }
        return
      }

      const createOrUpdate =
        await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
          ctx.params.contactCode,
          makeAdminApplicationProfileRequestParams(
            body,
            getApplicationProfile.ok ? getApplicationProfile.data : undefined
          )
        )

      if (!createOrUpdate.ok) {
        ctx.status = 500
        ctx.body = { error: 'unknown', ...metadata }
        return
      }

      ctx.status = createOrUpdate.statusCode ?? 200
      ctx.body = {
        content:
          schemas.admin.applicationProfile.UpdateApplicationProfileResponseData.parse(
            createOrUpdate.data
          ),
        ...metadata,
      }
    }
  )

  type UpdateClientApplicationProfileRequestParams = z.infer<
    typeof schemas.client.applicationProfile.UpdateApplicationProfileRequestParams
  >

  function makeClientApplicationProfileRequestParams(
    body: UpdateClientApplicationProfileRequestParams,
    existingProfile?: leasingAdapter.GetApplicationProfileResponseData
  ): leasingAdapter.CreateOrUpdateApplicationProfileRequestParams {
    return {
      expiresAt: dayjs(new Date()).add(6, 'months').toDate(),
      numChildren: body.numChildren,
      numAdults: body.numAdults,
      housingType: body.housingType,
      landlord: body.landlord,
      housingTypeDescription: body.housingTypeDescription,
      lastUpdatedAt: new Date(),
      housingReference: {
        comment: existingProfile?.housingReference.comment ?? null,
        email: body.housingReference.email,
        phone: body.housingReference.phone,
        reviewedAt: existingProfile?.housingReference.reviewedAt ?? null,
        reviewedBy: existingProfile?.housingReference.reviewedBy ?? null,
        reasonRejected:
          existingProfile?.housingReference.reasonRejected ?? null,
        reviewStatus:
          existingProfile?.housingReference.reviewStatus ?? 'PENDING',
        expiresAt: existingProfile?.housingReference.expiresAt ?? null,
      },
    }
  }

  /**
   * @swagger
   * /contacts/{contactCode}/application-profile/client:
   *   post:
   *     summary: Creates or updates an application profile by contact code
   *     description: Create or update application profile information by contact code.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code associated with the application profile.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *       properties:
   *         numAdults:
   *           type: number
   *           description: Number of adults in the current housing.
   *         numChildren:
   *           type: number
   *           description: Number of children in the current housing.
   *     responses:
   *       200:
   *         description: Successfully updated application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       201:
   *         description: Successfully created application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       500:
   *         description: Internal server error. Failed to update application profile information.
   */
  router.post(
    '/contacts/:contactCode/application-profile/client',
    parseRequestBody(
      schemas.client.applicationProfile.UpdateApplicationProfileRequestParams
    ),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      // TODO: Something wrong with parseRequestBody types.
      // Body should be inferred from middleware
      const body = ctx.request.body as z.infer<
        typeof schemas.client.applicationProfile.UpdateApplicationProfileRequestParams
      >

      const getApplicationProfile =
        await leasingAdapter.getApplicationProfileByContactCode(
          ctx.params.contactCode
        )

      if (
        !getApplicationProfile.ok &&
        getApplicationProfile.err !== 'not-found'
      ) {
        ctx.status = 500
        ctx.body = { error: 'unknown', ...metadata }
        return
      } else {
        const createOrUpdate =
          await leasingAdapter.createOrUpdateApplicationProfileByContactCode(
            ctx.params.contactCode,
            makeClientApplicationProfileRequestParams(
              body,
              getApplicationProfile.ok ? getApplicationProfile.data : undefined
            )
          )

        if (!createOrUpdate.ok) {
          ctx.status = 500
          ctx.body = { error: 'unknown', ...metadata }
          return
        }

        ctx.status = createOrUpdate.statusCode ?? 200
        ctx.body = {
          content:
            schemas.client.applicationProfile.UpdateApplicationProfileResponseData.parse(
              createOrUpdate.data
            ),
          ...metadata,
        }
      }
    }
  )

  /**
   * @swagger
   * /contacts/{contactCode}/{rentalObjectCode}/verify-application:
   *   get:
   *     summary: Validate max num residents.
   *     description: Checks if application is allowed based on current number of residents.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code associated with the application profile.
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code associated with the rental property.
   *     responses:
   *       200:
   *         description: Application allowed.
   *       403:
   *         description: Application not allowed.
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error. Failed to retrieve application profile information.
   */
  router.get(
    '/contacts/:contactCode/:rentalObjectCode/verify-application',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const applicationProfile =
        await leasingAdapter.getApplicationProfileByContactCode(
          ctx.params.contactCode
        )

      if (!applicationProfile.ok) {
        if (applicationProfile.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'Application profile not found', ...metadata }
          return
        } else {
          ctx.status = 500
          ctx.body = { error: 'Error getting application profile', ...metadata }
          return
        }
      }

      const rentalPropertyInfo =
        await propertyManagementAdapter.getApartmentRentalPropertyInfo(
          ctx.params.rentalObjectCode
        )

      if (!rentalPropertyInfo.ok) {
        if (rentalPropertyInfo.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'Rental property info not found', ...metadata }
          return
        } else {
          ctx.status = 500
          ctx.body = {
            error: 'Error getting rental property info',
            ...metadata,
          }
          return
        }
      }

      const isAllowedApplication = isAllowedNumResidents(
        rentalPropertyInfo.data.roomTypeCode,
        applicationProfile.data.numAdults + applicationProfile.data.numChildren
      )

      if (!isAllowedApplication) {
        ctx.status = 403
        ctx.body = {
          reason: 'Too many residents for this rental property',
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = { ...metadata }
    }
  )
}
