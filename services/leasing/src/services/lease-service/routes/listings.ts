import KoaRouter from '@koa/router'
import {
  ApplicantStatus,
  DetailedApplicant,
  InternalParkingSpaceSyncSuccessResponse,
  Listing,
  ListingStatus,
  UpdateListingStatusErrorCodes,
} from 'onecore-types'
import { z } from 'zod'
import { generateRouteMetadata, logger } from 'onecore-utilities'
import { match, P } from 'ts-pattern'

import { parseRequestBody } from '../../../middlewares/parse-request-body'
import * as priorityListService from '../priority-list-service'
import * as syncParkingSpacesFromXpandService from '../sync-internal-parking-space-listings-from-xpand'
import * as listingAdapter from '../adapters/listing-adapter'
import { getTenant } from '../get-tenant'
import { db } from '../adapters/db'

/**
 * @swagger
 * tags:
 *   - name: Listings
 *     description: Endpoints related to Listing operations
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /listings:
   *   post:
   *     summary: Create new listing
   *     description: Create a new listing.
   *     tags: [Listings]
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *     responses:
   *       201:
   *         description: Listing created successfully.
   *         content:
   *          application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       409:
   *         description: Conflict. Active listing with the same rentalObjectCode already exists.
   *       500:
   *         description: Internal server error. Failed to create listing.
   */
  router.post('(.*)/listings', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const listingData = <Listing>ctx.request.body
      const listing = await listingAdapter.createListing(listingData)

      if (!listing.ok) {
        if (listing.err === 'conflict-active-listing') {
          ctx.status = 409
          ctx.body = {
            reason: 'Active listing already exists for this rentalObjectCode',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: 'Internal server error',
          ...metadata,
        }

        return
      }

      ctx.status = 201
      ctx.body = { content: listing.data, ...metadata }
    } catch (error) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = { error: error.message, ...metadata }
      } else {
        ctx.body = { error: 'An unexpected error occurred.', ...metadata }
      }
    }
  })

  const CreateApplicantRequestParamsSchema = z.object({
    name: z.string(),
    nationalRegistrationNumber: z.string(),
    contactCode: z.string(),
    applicationDate: z.coerce.date(),
    applicationType: z.string().optional(),
    status: z.nativeEnum(ApplicantStatus),
    listingId: z.number(),
  })

  /**
   * @swagger
   * components:
   *   schemas:
   *     CreateApplicantRequestParams:
   *       type: object
   *       required:
   *         - name
   *         - nationalRegistrationNumber
   *         - contactCode
   *         - applicationDate
   *         - status
   *         - listingId
   *       properties:
   *         name:
   *           type: string
   *           description: The name of the applicant.
   *         nationalRegistrationNumber:
   *           type: string
   *           description: The national registration number of the applicant.
   *         contactCode:
   *           type: string
   *           description: The contact code of the applicant.
   *         applicationDate:
   *           type: string
   *           format: date-time
   *           description: The date when the application was submitted.
   *         applicationType:
   *           type: string
   *           description: The type of application (optional).
   *         status:
   *           type: string
   *           enum:
   *             - PENDING
   *             - APPROVED
   *             - REJECTED
   *             - WITHDRAWN_BY_USER
   *             - WITHDRAWN_BY_ADMIN
   *           description: The status of the applicant.
   *         listingId:
   *           type: number
   *           description: The ID of the listing to which the applicant is applying.
   *     Error:
   *       type: object
   *       properties:
   *         error:
   *           type: string
   *
   * /listings/apply:
   *   post:
   *     summary: Create new application for contact on listing
   *     description: Apply for a listing.
   *     tags: [Listings]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateApplicantRequestParams'
   *     responses:
   *       201:
   *        content:
   *          application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       409:
   *         description: Conflict. Applicant has already applied for this listing.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error. Failed to create application.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  //todo: test cases to write:
  //can add applicant
  //cannot add duplicate applicant
  //handle non existing applicant contact code
  router.post(
    '(.*)/listings/apply',
    parseRequestBody(CreateApplicantRequestParamsSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const applicantData = ctx.request.body

        const exists = await listingAdapter.applicationExists(
          applicantData.contactCode,
          applicantData.listingId
        )

        if (exists) {
          ctx.status = 409 // Conflict
          ctx.body = {
            reason: 'Applicant has already applied for this listing.',
            ...metadata,
          }
          return
        }

        //todo: createApplication does not actually return any data
        const applicationId =
          await listingAdapter.createApplication(applicantData)
        ctx.status = 201 // HTTP status code for Created
        ctx.body = { content: applicationId, ...metadata }
      } catch (error) {
        ctx.status = 500 // Internal Server Error
        if (error instanceof Error) {
          ctx.body = { error: error.message, ...metadata }
        } else {
          ctx.body = { error: 'An unexpected error occurred.', ...metadata }
        }
      }
    }
  )

  /**
   * @swagger
   * /listings/by-id/{listingId}:
   *   get:
   *     summary: Get a listing by ID
   *     description: Fetches a listing from the database using its ID.
   *     tags:
   *       - Listings
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the listing to fetch.
   *     responses:
   *       '200':
   *         description: Successfully retrieved listing.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   description: The ID of the listing.
   *                 name:
   *                   type: string
   *                   description: The name of the listing.
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
  router.get('/listings/by-id/:listingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const listingId = ctx.params.listingId
      const listing = await listingAdapter.getListingById(Number(listingId))
      if (listing == undefined) {
        ctx.status = 404
        ctx.body = { reason: 'Listing not found', ...metadata }
        return
      }

      ctx.body = { content: listing, ...metadata }
      ctx.status = 200
    } catch (error) {
      logger.error(error, 'Error fetching listing: ' + ctx.params.listingId)
      ctx.status = 500 // Internal Server Error
      ctx.body = {
        error:
          'An error occurred while fetching listing with the provided listingId: ' +
          ctx.params.listingId,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /listings/active/by-code/{rentalObjectCode}:
   *   get:
   *     summary: Get an active listing by Rental Object Code
   *     description: Fetches an active listing from the database using its Rental Object Code.
   *     tags:
   *       - Listings
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental Object Code of the listing to fetch.
   *     responses:
   *       '200':
   *         description: Successfully retrieved listing.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   description: The ID of the listing.
   *                 name:
   *                   type: string
   *                   description: The name of the listing.
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
  router.get('/listings/active/by-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rentaLObjectCode = ctx.params.rentalObjectCode
      const listing =
        await listingAdapter.getActiveListingByRentalObjectCode(
          rentaLObjectCode
        )
      if (listing == undefined) {
        ctx.status = 404
        ctx.body = { reason: 'Listing not found', ...metadata }
        return
      }

      ctx.body = { content: listing, ...metadata }
      ctx.status = 200
    } catch (error) {
      logger.error(
        error,
        'Error fetching listing: ' + ctx.params.rentalObjectCode
      )
      ctx.status = 500 // Internal Server Error
      ctx.body = {
        error:
          'An error occurred while fetching listing with the provided rentalObjectCode: ' +
          ctx.params.rentalObjectCode,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /listings-with-applicants:
   *   get:
   *     summary: Get listings with applicants
   *     description: Fetches all listings with their associated applicants.
   *     tags:
   *       - Listings
   *     parameters:
   *       - in: query
   *         name: type
   *         required: false
   *         schema:
   *           type: string
   *           enum: [published, ready-for-offer, offered, historical, needs-republish]
   *         description: Filters listings by one of the above types. Must be one of the specified values.
   *     responses:
   *       '200':
   *         description: Successfully retrieved listings with applicants.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     description: The ID of the listing.
   *                   name:
   *                     type: string
   *                     description: The name of the listing.
   *                   applicants:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                           description: The ID of the applicant.
   *                         name:
   *                           type: string
   *                           description: The name of the applicant.
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
  router.get('/listings-with-applicants', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const opts = match(ctx.query.type)
      .with(
        P.union(
          'published',
          'ready-for-offer',
          'offered',
          'historical',
          'needs-republish'
        ),
        (type) => ({ by: { type } })
      )
      .otherwise(() => undefined)

    const listingsWithApplicants =
      await listingAdapter.getListingsWithApplicants(db, opts)

    if (!listingsWithApplicants.ok) {
      logger.error(
        listingsWithApplicants.err,
        'Error fetching listings with applicants:'
      )
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching listings with applicants.',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { content: listingsWithApplicants.data, ...metadata }
  })

  router.get('/listings/readyforoffers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const listings = await listingAdapter.getExpiredListingsWithNoOffers()

    if (!listings.ok) {
      ctx.status = 500
      ctx.body = {
        err: 'Could not retrieve listings ready for offers',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: listings.data,
      ...metadata,
    }
  })

  router.post('/listings/sync-internal-from-xpand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result =
      await syncParkingSpacesFromXpandService.syncInternalParkingSpaces(db)

    if (!result.ok) {
      logger.error(
        'Error when syncing internal parking spaces from Xpand SOAP API'
      )

      ctx.status = 500
      ctx.body = { err: 'Internal server error', ...metadata }
      return
    }

    logger.info('Finished syncing listings from Xpand SOAP API')
    if (result.data.insertions.failed.length) {
      logger.info(
        result.data.insertions.failed.map((v) => ({
          rentalObjectCode: v.listing.rentalObjectCode,
          status: v.listing.status,
          err: v.err,
        })),
        'Failed to insert the following listings when syncing from Xpand SOAP API:'
      )
    }

    const mapToResponseData = (
      data: (typeof result)['data']
    ): InternalParkingSpaceSyncSuccessResponse => ({
      invalid: result.data.invalid,
      insertions: {
        inserted: data.insertions.inserted.map((v) => ({
          id: v.id,
          rentalObjectCode: v.rentalObjectCode,
        })),
        failed: data.insertions.failed.map((v) => ({
          rentalObjectCode: v.listing.rentalObjectCode,
          err:
            v.err === 'conflict-active-listing'
              ? 'active-listing-exists'
              : v.err,
        })),
      },
    })

    ctx.status = 200
    ctx.body = {
      content: mapToResponseData(result.data),
      ...metadata,
    }
  })

  /**
   * Gets detailed information on a listings applicants
   * Returns a sorted list by rental rules for internal parking spaces of all applicants on a listing by listing id
   * Uses ListingId instead of rentalObjectCode since multiple listings can share the same rentalObjectCode for historical reasons
   */
  /**
   * @swagger
   * /listing/{listingId}/applicants/details:
   *   get:
   *     summary: Get detailed applicant information for a listing
   *     description: Fetches detailed information about applicants for a specific listing.
   *     tags:
   *       - Listings
   *     parameters:
   *       - in: path
   *         name: listingId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the listing for which applicants details are requested.
   *     responses:
   *       '200':
   *         description: Successfully retrieved detailed applicants information.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     description: The ID of the applicant.
   *                   name:
   *                     type: string
   *                     description: The name of the applicant.
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
  router.get('(.*)/listing/:listingId/applicants/details', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const listingId = ctx.params.listingId
      const listing = await listingAdapter.getListingById(Number(listingId))

      if (!listing) {
        ctx.status = 404
        ctx.body = {
          reason: 'Listing not found',
          ...metadata,
        }
        return
      }

      const applicants: DetailedApplicant[] = []

      if (listing.applicants) {
        for (const applicant of listing.applicants) {
          const tenant = await getTenant({
            contactCode: applicant.contactCode,
          })

          if (!tenant.ok) {
            throw new Error(
              'Err when getting detailed applicant information: ' + tenant.err
            )
          }

          applicants.push({
            ...applicant,
            contactCode: tenant.data.contactCode,
            nationalRegistrationNumber: tenant.data.nationalRegistrationNumber,
            queuePoints: tenant.data.parkingSpaceWaitingList
              ? tenant.data.parkingSpaceWaitingList.queuePoints
              : 0,
            address: tenant.data.address,
            currentHousingContract: tenant.data.currentHousingContract,
            upcomingHousingContract: tenant.data.upcomingHousingContract,
            parkingSpaceContracts: tenant.data.parkingSpaceContracts,
            priority: null,
          })
        }
      }

      const applicantsWithPriority =
        priorityListService.addPriorityToApplicantsBasedOnRentalRules(
          listing,
          applicants
        )
      ctx.status = 200
      ctx.body = {
        content: priorityListService.sortApplicantsBasedOnRentalRules(
          applicantsWithPriority
        ),
        ...metadata,
      }
    } catch (error: unknown) {
      logger.error(error, 'Error getting applicants for listing')
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
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
    const result = await listingAdapter.deleteListing(
      Number(ctx.params.listingId)
    )

    if (!result.ok) {
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = { reason: 'Could not delete listing.', ...metadata }
        return
      }
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
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
   *       - Listings
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
  const UpdateListingStatusRequestParamsSchema = z.object({
    status: z.nativeEnum(ListingStatus),
  })

  router.put(
    '(.*)/listings/:listingId/status',
    parseRequestBody(UpdateListingStatusRequestParamsSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const result = await listingAdapter.updateListingStatuses(
        [Number(ctx.params.listingId)],
        ctx.request.body.status
      )

      if (!result.ok) {
        if (result.err === 'no-update') {
          ctx.status = 404
          ctx.body = {
            error: UpdateListingStatusErrorCodes.NotFound,
            ...metadata,
          }
          return
        } else {
          ctx.status = 500
          ctx.body = {
            error: UpdateListingStatusErrorCodes.Unknown,
            ...metadata,
          }
          return
        }
      }

      ctx.status = 200
      ctx.body = { ...metadata }
    }
  )
}
