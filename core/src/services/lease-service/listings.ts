/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { Listing, ListingStatus } from '@onecore/types'
import { z } from 'zod'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as internalParkingSpaceProcesses from '../../processes/parkingspaces/internal'
import { ProcessStatus } from '../../common/types'
import { isTenantAllowedToRentAParkingSpaceInThisResidentialArea } from './helpers/lease'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /listings:
   *   get:
   *     summary: Get listings
   *     tags:
   *       - Lease service
   *     description: Retrieves a list of listings.
   *     parameters:
   *       - in: query
   *         name: listingCategory
   *         required: false
   *         schema:
   *           type: string
   *         description: The listing category, either PARKING_SPACE, APARTMENT or STORAGE.
   *       - in: query
   *         name: published
   *         required: false
   *         schema:
   *           type: boolean
   *         description: true for published listings, false for unpublished listings.
   *       - in: query
   *         name: rentalRule
   *         required: false
   *         schema:
   *           type: string
   *         description: The rental rule for the listings, either SCORED or NON_SCORED.
   *       - in: query
   *         name: validToRentForContactCode
   *         required: false
   *         schema:
   *           type: string
   *         description: A contact code to filter out listings that are not valid to rent for the contact.
   *     responses:
   *       '200':
   *         description: Successful response with the requested list of listings.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/listings', async (ctx) => {
    try {
      const metadata = generateRouteMetadata(ctx)

      const querySchema = z.object({
        listingCategory: z
          .enum(['PARKING_SPACE', 'APARTMENT', 'STORAGE'])
          .optional(),
        published: z
          .enum(['true', 'false'])
          .optional()
          .transform((value) => (value ? value === 'true' : undefined)),
        rentalRule: z.enum(['SCORED', 'NON_SCORED']).optional(),
        validToRentForContactCode: z.string().optional(),
      })
      const query = querySchema.safeParse(ctx.query)

      logger.debug({ query }, 'Parsed query parameters for GET /listings')

      const result = await leasingAdapter.getListings({
        listingCategory: query.data?.listingCategory,
        published: query.data?.published,
        rentalRule: query.data?.rentalRule,
      })

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Error getting listings from leasing', ...metadata }
        return
      }

      const parkingSpacesResult = await leasingAdapter.getParkingSpaces(
        result.data.map((listing) => listing.rentalObjectCode)
      )
      if (!parkingSpacesResult.ok) {
        parkingSpacesResult.err === 'not-found'
          ? (ctx.status = 404)
          : (ctx.status = 500)
        ctx.body = {
          error: 'Error getting parking spaces from leasing',
          ...metadata,
        }
        return
      }

      //TODO flytta til leasing när adaptern flyttats från property-mgmt
      const listingsWithRentalObjects: Listing[] = result.data
        .map((listing) => {
          const rentalObject = parkingSpacesResult.data.find(
            (ps) => ps.rentalObjectCode === listing.rentalObjectCode
          )
          if (!rentalObject) return undefined
          listing.rentalObject = rentalObject
          return listing
        })
        .filter((item): item is Listing => !!item)

      logger.info(
        {
          numberOfListings: listingsWithRentalObjects.length,
        },
        'Listings Retrieved from Leasing GET /listings'
      )

      if (!query.data?.validToRentForContactCode) {
        ctx.status = 200
        ctx.body = { content: listingsWithRentalObjects, ...metadata }
      } else {
        //filter listings on validToRentForContactCode
        const tenantResult = await leasingAdapter.getTenantByContactCode(
          query.data?.validToRentForContactCode
        )
        let isTenant = true

        if (!tenantResult.ok) {
          if (tenantResult.err === 'contact-not-tenant') {
            isTenant = false
          } else {
            ctx.status = 500
            ctx.body = { error: 'Tenant could not be retrieved', ...metadata }
            return
          }
        }

        var listings = listingsWithRentalObjects.filter((listing) => {
          return (
            listing.rentalRule == 'NON_SCORED' || //all NON_SCORED will be included
            (listing.rentalRule == 'SCORED' &&
              isTenant &&
              tenantResult.ok &&
              listing.rentalObject.residentialAreaCode &&
              isTenantAllowedToRentAParkingSpaceInThisResidentialArea(
                listing.rentalObject.residentialAreaCode,
                tenantResult.data
              )) // all SCORED where tenant is allowed to rent will be included
          )
        })

        logger.debug(
          {
            numberOfListings: listings.length,
            contactCode: query.data?.validToRentForContactCode,
          },
          'Listings filtered on contact GET /listings'
        )

        ctx.status = 200
        ctx.body = { content: listings, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error fetching listings with rental objects')
      ctx.status = 500
    }
  })

  /**
   * @swagger
   * /listings/{listingId}:
   *   delete:
   *     summary: Delete a Listing by ID
   *     description: Deletes a listing by it's ID.
   *     tags:
   *       - Lease service
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
  router.delete('/listings/:listingId', async (ctx) => {
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
   * /listings/{listingId}/status:
   *   put:
   *     summary: Update a listings status by ID
   *     description: Updates a listing status by it's ID.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: number
   *         description: ID of the listing to delete.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *       properties:
   *         status:
   *           type: number
   *           description: The listing status.
   *     responses:
   *       '200':
   *         description: Successfully updated listing.
   *       '404':
   *         description: Listing not found.
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
  router.put('/listings/:listingId/status', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.updateListingStatus(
      Number(ctx.params.listingId),
      ctx.request.body.status
    )

    if (!result.ok) {
      ctx.status = result.statusCode ?? 500
      ctx.body = { ...metadata, error: result.err }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
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
  router.post('/listings/:listingId/offers', async (ctx) => {
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
   * /listings/{listingId}/applicants/details:
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
  router.get('/listings/:listingId/applicants/details', async (ctx) => {
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
   * /listings/{id}:
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
  router.get('/listings/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = (await leasingAdapter.getListingByListingId(
      Number.parseInt(ctx.params.id)
    )) as Listing | undefined
    if (!responseData) {
      ctx.status = 404
      ctx.body = { error: 'Listing not found', ...metadata }
      return
    }

    const parkingSpacesResult = await leasingAdapter.getParkingSpaceByCode(
      responseData.rentalObjectCode
    )

    if (!parkingSpacesResult.ok) {
      parkingSpacesResult.err === 'not-found'
        ? (ctx.status = 404)
        : (ctx.status = 500)
      ctx.body = {
        error: 'Error getting parking spaces from leasing',
        ...metadata,
      }
      return
    }

    const listingWithRentalObject = {
      ...responseData,
      rentalObject: parkingSpacesResult.data,
    }

    ctx.body = { content: listingWithRentalObject, ...metadata }
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

    const parkingSpacesResult = await leasingAdapter.getParkingSpaces(
      result.data.map((listing) => listing.rentalObjectCode)
    )
    if (!parkingSpacesResult.ok) {
      parkingSpacesResult.err === 'not-found'
        ? (ctx.status = 404)
        : (ctx.status = 500)
      ctx.body = {
        error: 'Error getting parking spaces from leasing',
        ...metadata,
      }
      return
    }

    const listingsWithRentalObjects: Listing[] = result.data
      .map((listing) => {
        const rentalObject = parkingSpacesResult.data.find(
          (ps) => ps.rentalObjectCode === listing.rentalObjectCode
        )
        if (!rentalObject) return undefined
        listing.rentalObject = rentalObject
        return listing
      })
      .filter((item): item is Listing => !!item)

    ctx.status = 200
    ctx.body = { content: listingsWithRentalObjects, ...metadata }
  })
  /**
   * @swagger
   * /listings/batch:
   *   post:
   *     summary: Create multiple listings
   *     tags:
   *       - Lease service
   *     description: Create multiple listings in a single request.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - listings
   *               properties:
   *                 listings:
   *                   type: array
   *                   items:
   *                     type: object
   *                     required:
   *                       - rentalObjectCode
   *                       - publishedFrom
   *                       - publishedTo
   *                       - status
   *                       - rentalRule
   *                       - listingCategory
   *                     properties:
   *                       rentalObjectCode:
   *                         type: string
   *                       publishedFrom:
   *                         type: string
   *                         format: date-time
   *                       publishedTo:
   *                         type: string
   *                         format: date-time
   *                       status:
   *                         type: string
   *                         enum: [ACTIVE, INACTIVE, CLOSED, ASSIGNED, EXPIRED, NO_APPLICANTS]
   *                       rentalRule:
   *                         type: string
   *                         enum: [SCORED, NON_SCORED]
   *                       listingCategory:
   *                         type: string
   *                         enum: [PARKING_SPACE, APARTMENT, STORAGE]
   *     responses:
   *       201:
   *         description: All listings created successfully.
   *         content:
   *          application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *       207:
   *         description: Partial success. Some listings created, some failed.
   *       400:
   *         description: Bad request. Invalid input data.
   *       500:
   *         description: Internal server error. Failed to create listings.
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/listings/batch', async (ctx) => {
    try {
      const metadata = generateRouteMetadata(ctx)

      const requestBodySchema = z.object({
        listings: z.array(
          z.object({
            rentalObjectCode: z.string(),
            publishedFrom: z.coerce.date(),
            publishedTo: z.coerce.date().optional(),
            status: z.nativeEnum(ListingStatus),
            rentalRule: z.enum(['SCORED', 'NON_SCORED']),
            listingCategory: z.enum(['PARKING_SPACE', 'APARTMENT', 'STORAGE']),
          })
        ),
      })

      const parseResult = requestBodySchema.safeParse(ctx.request.body)

      if (!parseResult.success) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid request body',
          details: parseResult.error.issues,
          ...metadata,
        }
        return
      }

      const { listings } = parseResult.data

      // Call the leasing service adapter to create multiple listings
      const result = await leasingAdapter.createMultipleListings(listings)

      if (!result.ok) {
        if (result.err === 'partial-failure') {
          ctx.status = 207
          ctx.body = {
            error: 'Some listings could not be created',
            message:
              'Partial success - some listings were created successfully while others failed',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: 'Failed to create listings',
          ...metadata,
        }
        return
      }

      // Try to get rental objects for the created listings
      try {
        const rentalObjectCodes = result.data.map(
          (listing) => listing.rentalObjectCode
        )
        const parkingSpacesResult =
          await leasingAdapter.getParkingSpaces(rentalObjectCodes)

        if (parkingSpacesResult.ok) {
          // Add rental objects to listings
          const listingsWithRentalObjects = result.data.map((listing) => {
            const rentalObject = parkingSpacesResult.data.find(
              (ps) => ps.rentalObjectCode === listing.rentalObjectCode
            )
            if (rentalObject) {
              return { ...listing, rentalObject }
            }
            return listing
          })

          ctx.status = 201
          ctx.body = {
            content: listingsWithRentalObjects,
            message: `Successfully created ${result.data.length} listings`,
            ...metadata,
          }
        } else {
          // Return listings without rental objects if we can't fetch them
          logger.warn(
            { rentalObjectCodes },
            'Could not fetch rental objects for created listings'
          )
          ctx.status = 201
          ctx.body = {
            content: result.data,
            message: `Successfully created ${result.data.length} listings`,
            ...metadata,
          }
        }
      } catch (rentalObjectError) {
        logger.error(
          rentalObjectError,
          'Error fetching rental objects for created listings'
        )
        // Return listings without rental objects if there's an error
        ctx.status = 201
        ctx.body = {
          content: result.data,
          message: `Successfully created ${result.data.length} listings`,
          ...metadata,
        }
      }
    } catch (error) {
      logger.error(error, 'Error in createMultipleListings endpoint')
      ctx.status = 500
      const metadata = generateRouteMetadata(ctx)
      ctx.body = { error: 'An unexpected error occurred', ...metadata }
    }
  })
}
