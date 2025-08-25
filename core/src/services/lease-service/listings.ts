/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { z } from 'zod'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { Listing, ListingStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

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
  router.get('(.*)/listings', async (ctx) => {
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

      const result = await leasingAdapter.getListings({
        listingCategory: query.data?.listingCategory,
        published: query.data?.published,
        rentalRule: query.data?.rentalRule,
        validToRentForContactCode: query.data?.validToRentForContactCode,
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

      ctx.status = 200
      ctx.body = { content: listingsWithRentalObjects, ...metadata }
    } catch (error) {
      logger.error(error, 'Error fetching listings with rental objects')
      ctx.status = 500
    }
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
            error: 'Some listings failed to create',
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
