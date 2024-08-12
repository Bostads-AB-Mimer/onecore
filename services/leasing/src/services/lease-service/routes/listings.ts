import KoaRouter from '@koa/router'
import { ApplicantStatus, DetailedApplicant, Listing } from 'onecore-types'
import {
  applicationExists,
  createApplication,
  createListing,
  getAllListingsWithApplicants,
  getListingById,
  getListingByRentalObjectCode,
} from '../adapters/listing-adapter'
import { z } from 'zod'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { logger } from 'onecore-utilities'
import {
  addPriorityToApplicantsBasedOnRentalRules,
  getDetailedApplicantInformation,
  sortApplicantsBasedOnRentalRules,
} from '../priority-list-service'

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
   *         description: Conflict. Listing with the same rentalObjectCode already exists.
   *       500:
   *         description: Internal server error. Failed to create listing.
   */
  //todo: test cases to write:
  //can add listing
  //cannot add duplicate listing
  router.post('(.*)/listings', async (ctx) => {
    try {
      const listingData = <Listing>ctx.request.body
      const existingListing = await getListingByRentalObjectCode(
        listingData.rentalObjectCode
      )
      if (
        existingListing != null &&
        existingListing.rentalObjectCode === listingData.rentalObjectCode
      ) {
        ctx.status = 409
        return
      }

      const listing = await createListing(listingData)

      ctx.status = 201 // HTTP status code for Created
      ctx.body = listing
    } catch (error) {
      ctx.status = 500 // Internal Server Error

      if (error instanceof Error) {
        ctx.body = { error: error.message }
      } else {
        ctx.body = { error: 'An unexpected error occurred.' }
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
      try {
        const applicantData = ctx.request.body

        const exists = await applicationExists(
          applicantData.contactCode,
          applicantData.listingId
        )

        if (exists) {
          ctx.status = 409 // Conflict
          ctx.body = {
            error: 'Applicant has already applied for this listing.',
          }
          return
        }

        //todo: createApplication does not actually return any data
        const applicationId = await createApplication(applicantData)
        ctx.status = 201 // HTTP status code for Created
        ctx.body = { applicationId }
      } catch (error) {
        ctx.status = 500 // Internal Server Error
        if (error instanceof Error) {
          ctx.body = { error: error.message }
        } else {
          ctx.body = { error: 'An unexpected error occurred.' }
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
    try {
      const listingId = ctx.params.listingId
      const listing = await getListingById(listingId)
      if (listing == undefined) {
        ctx.status = 404
        return
      }

      ctx.body = listing
      ctx.status = 200
    } catch (error) {
      logger.error(error, 'Error fetching listing: ' + ctx.params.listingId)
      ctx.status = 500 // Internal Server Error
      ctx.body = {
        error:
          'An error occurred while fetching listing with the provided listingId: ' +
          ctx.params.listingId,
      }
    }
  })

  /**
   * @swagger
   * /listings/by-code/{rentalObjectCode}:
   *   get:
   *     summary: Get a listing by Rental Object Code
   *     description: Fetches a listing from the database using its Rental Object Code.
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
  router.get('/listings/by-code/:rentalObjectCode', async (ctx) => {
    try {
      const rentaLObjectCode = ctx.params.rentalObjectCode
      const listing = await getListingByRentalObjectCode(rentaLObjectCode)
      if (listing == undefined) {
        ctx.status = 404
        return
      }

      ctx.body = listing
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
      }
    }
  })

  /**
   * @swagger
   * /listings-with-applicants:
   *   get:
   *     summary: Get listings with applicants
   *     description: Fetches all listings that have associated applicants.
   *     tags:
   *       - Listings
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
    try {
      const listingsWithApplicants = await getAllListingsWithApplicants()
      ctx.body = listingsWithApplicants
      ctx.status = 200
    } catch (error) {
      logger.error(error, 'Error fetching listings with applicants:')
      ctx.status = 500 // Internal Server Error
      ctx.body = {
        error: 'An error occurred while fetching listings with applicants.',
      }
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
    try {
      const listingId = ctx.params.listingId
      const listing = await getListingById(listingId)

      if (!listing) {
        ctx.status = 404
        return
      }

      const applicants: DetailedApplicant[] = []

      if (listing.applicants) {
        for (const applicant of listing.applicants) {
          const detailedApplicant =
            await getDetailedApplicantInformation(applicant)
          if (!detailedApplicant.ok)
            throw new Error('Err when getting detailed applicant information')
          applicants.push(detailedApplicant.data)
        }
      }

      const applicantsWithPriority = addPriorityToApplicantsBasedOnRentalRules(
        listing,
        applicants
      )

      ctx.body = sortApplicantsBasedOnRentalRules(applicantsWithPriority)
    } catch (error: unknown) {
      logger.error(error, 'Error getting applicants for waiting list')
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
        }
      }
    }
  })
}
