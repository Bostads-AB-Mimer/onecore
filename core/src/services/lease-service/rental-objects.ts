/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { leasing } from '@onecore/types'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { RentalObjectRentInfo } from './schemas/lease'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /vacant-parkingspaces:
   *   get:
   *     summary: Get all vacant parking spaces
   *     tags:
   *       - Lease service
   *     description: Retrieves a list of all vacant parking spaces.
   *     responses:
   *       '200':
   *         description: A list of vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rentalObjectCode:
   *                         type: string
   *                       address:
   *                         type: string
   *                       rent:
   *                         type: object
   *                         properties:
   *                           amount:
   *                             type: number
   *                       propertyCaption:
   *                         type: string
   *                       propertyCode:
   *                         type: string
   *                       residentialAreaCode:
   *                         type: string
   *                       residentialAreaCaption:
   *                         type: string
   *                       objectTypeCaption:
   *                         type: string
   *                       objectTypeCode:
   *                         type: string
   *                       vacantFrom:
   *                         type: string
   *                         format: date-time
   *                       districtCaption:
   *                         type: string
   *                       districtCode:
   *                         type: string
   *                       braArea:
   *                         type: number
   *                       hasListingTextContent:
   *                         type: boolean
   *                         description: |
   *                           Whether listing text content exists for the
   *                           parking space. Omitted if the text content
   *                           lookup in leasing failed.
   *       '500':
   *         description: Internal server error. Failed to retrieve vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: Error message.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getAllVacantParkingSpaces()
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
   * /rental-objects/by-code/{rentalObjectCode}:
   *   get:
   *     summary: Get a rental object by code
   *     description: Fetches a rental object by Rental Object Code.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the rental object to fetch.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rentalObjectCode:
   *                         type: string
   *                       address:
   *                         type: string
   *                       rent:
   *                         type: object
   *                         properties:
   *                           amount:
   *                             type: number
   *                       propertyCaption:
   *                         type: string
   *                       propertyCode:
   *                         type: string
   *                       residentialAreaCode:
   *                         type: string
   *                       residentialAreaCaption:
   *                         type: string
   *                       objectTypeCaption:
   *                         type: string
   *                       objectTypeCode:
   *                         type: string
   *                       vacantFrom:
   *                         type: string
   *                         format: date-time
   *                       districtCaption:
   *                         type: string
   *                       districtCode:
   *                         type: string
   *                       braArea:
   *                         type: number
   *       '500':
   *         description: Internal server error. Failed to fetch rental object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/parking-spaces/by-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode
    const result = await leasingAdapter.getParkingSpaceByCode(rentalObjectCode)

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
   * /rental-objects/by-code/{rentalObjectCode}/availability:
   *   get:
   *     summary: Get availability for a rental object
   *     description: |
   *       Fetches availability for a rental object by Rental Object Code.
   *       The rent total (rent.amount, rent.vat) is the rent of today, unless
   *       a later move-in day is known. For a parking space that day is its
   *       vacantFrom. For other rental objects vacantFrom is not set, so the
   *       caller gives the day as rentAt. The total is then the sum of the
   *       rent rows in force that day with includedInRent set.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code of the availability to fetch.
   *       - in: query
   *         name: rentAt
   *         required: false
   *         schema:
   *           type: string
   *           format: date
   *         description: |
   *           The day to give the rent total for (yyyy-mm-dd), for rental
   *           objects that are not parking spaces. Left out, today or earlier
   *           gives the rent of today. Ignored for parking spaces.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object availability.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     rentalObjectCode:
   *                       type: string
   *                     vacantFrom:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     rent:
   *                       type: object
   *                       properties:
   *                         amount:
   *                           type: number
   *                         vat:
   *                           type: number
   *                         asOf:
   *                           type: string
   *                           format: date-time
   *                           description: |
   *                             The day the total (amount, vat) is the rent of.
   *                             Today when the total was not recalculated for
   *                             the move-in day, which also happens when the
   *                             rows for that day look incomplete.
   *                         rows:
   *                           type: array
   *                           items:
   *                             type: object
   *       '400':
   *         description: rentAt is not a valid day (error invalid-rent-at).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   enum: [invalid-rent-at]
   *       '500':
   *         description: Internal server error. Failed to fetch rental object availability.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *       '404':
   *         description: Not found. The availability of the specified rental object was not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/rental-objects/by-code/:rentalObjectCode/availability',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const rentalObjectCode = ctx.params.rentalObjectCode

      const query = leasing.v1.RentalObjectAvailabilityQuerySchema.safeParse(
        ctx.query
      )
      if (!query.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid-rent-at', ...metadata }
        return
      }

      const result = await leasingAdapter.getRentalObjectAvailabilityByCode(
        rentalObjectCode,
        query.data.rentAt
      )

      if (!result.ok && result.err === 'availability-not-found') {
        ctx.status = 404
        ctx.body = { error: 'Availability not found', ...metadata }
        return
      } else if (!result.ok && result.err === 'invalid-rent-at') {
        ctx.status = 400
        ctx.body = { error: 'invalid-rent-at', ...metadata }
        return
      } else if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error:
            'Unexpected error when getting availability for ' +
            rentalObjectCode,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /rental-objects/by-code/{rentalObjectCode}/rent:
   *   get:
   *     summary: Get rent for a rental object
   *     description: Fetches the rental object's configured rent from Tenfast, independent of any lease. Works for vacant objects.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to fetch rent for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object rent.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/RentalObjectRentInfo'
   *       '404':
   *         description: Not found. The specified rental object was not found.
   *       '500':
   *         description: Internal server error. Failed to fetch rental object rent.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/rental-objects/by-code/:rentalObjectCode/rent', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode

    const result =
      await leasingAdapter.getRentalObjectRentByCode(rentalObjectCode)

    if (!result.ok && result.err === 'not-found') {
      ctx.status = 404
      ctx.body = { error: 'Rental object not found', ...metadata }
      return
    }

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Unexpected error when getting rent for ' + rentalObjectCode,
        ...metadata,
      }
      return
    }

    const parsed = RentalObjectRentInfo.safeParse(result.data)
    if (!parsed.success) {
      logger.error(
        { rentalObjectCode, issues: parsed.error.issues },
        'Rental object rent from leasing did not match schema'
      )
      ctx.status = 500
      ctx.body = { error: 'Invalid rental object rent data', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: parsed.data, ...metadata }
  })

  /**
   * @swagger
   * /rental-objects/by-code/{rentalObjectCode}/rent-legacy:
   *   get:
   *     summary: Get legacy (Xpand) rent for a rental object
   *     description: Fetches the rental object's rent rows from Xpand, converted to monthly amounts. Used to compare against Tenfast during the transition.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to fetch legacy rent for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the legacy rental object rent.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/RentalObjectRentInfo'
   *       '404':
   *         description: Not found. No rent rows exist in Xpand for the specified rental object.
   *       '500':
   *         description: Internal server error. Failed to fetch legacy rental object rent.
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/rental-objects/by-code/:rentalObjectCode/rent-legacy',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const rentalObjectCode = ctx.params.rentalObjectCode

      const result =
        await leasingAdapter.getRentalObjectLegacyRentByCode(rentalObjectCode)

      if (!result.ok && result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'No legacy rent rows found', ...metadata }
        return
      }

      if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error:
            'Unexpected error when getting legacy rent for ' + rentalObjectCode,
          ...metadata,
        }
        return
      }

      const parsed = RentalObjectRentInfo.safeParse(result.data)
      if (!parsed.success) {
        logger.error(
          { rentalObjectCode, issues: parsed.error.issues },
          'Legacy rental object rent from leasing did not match schema'
        )
        ctx.status = 500
        ctx.body = {
          error: 'Invalid legacy rental object rent data',
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = { content: parsed.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /rental-objects/availabilities:
   *   post:
   *     summary: Get availabilities for rental objects
   *     description: |
   *       Fetches availabilities for rental objects by Rental Object Codes.
   *       The rent total (rent.amount, rent.vat) is the rent of today, unless
   *       a later move-in day is known. For a parking space that day is its
   *       vacantFrom. For other rental objects vacantFrom is not set, so the
   *       caller gives the day in rentAtByRentalObjectCode. The total is then
   *       the sum of the rent rows in force that day with includedInRent set.
   *     tags:
   *       - Lease service
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               rentalObjectCodes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of rental object codes to include.
   *                 example: ["ABC123", "DEF456", "GHI789"]
   *               rentAtByRentalObjectCode:
   *                 type: object
   *                 additionalProperties:
   *                   type: string
   *                   format: date
   *                 description: |
   *                   The day to give the rent total for (yyyy-mm-dd), per
   *                   rental object code, for rental objects that are not
   *                   parking spaces. A code left out, today or earlier gives
   *                   the rent of today. Ignored for parking spaces. Codes
   *                   are matched without regard to case or surrounding
   *                   blanks. rent.asOf in the response says which day each
   *                   total is the rent of.
   *                 example: { "ABC123": "2027-01-16" }
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object availabilities.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rentalObjectCode:
   *                         type: string
   *                       vacantFrom:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       rent:
   *                         type: object
   *                         properties:
   *                           amount:
   *                             type: number
   *                           vat:
   *                             type: number
   *                           asOf:
   *                             type: string
   *                             format: date-time
   *                             description: |
   *                               The day the total (amount, vat) is the rent
   *                               of. Today when the total was not recalculated
   *                               for the move-in day, which also happens when
   *                               the rows for that day look incomplete.
   *                           rows:
   *                             type: array
   *                             items:
   *                               type: object
   *       '400':
   *         description: The request body is invalid, such as a rentAtByRentalObjectCode value that is not a valid day (error invalid-request when reported by the leasing service).
   *       '500':
   *         description: Internal server error. Failed to fetch rental object availabilities.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *       '404':
   *         description: Not found. The availability of the specified rental object was not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/rental-objects/availabilities',
    parseRequestBody(leasing.v1.RentalObjectAvailabilitiesRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      // Parsed by parseRequestBody above; koa's ctx doesn't carry its type.
      const body = ctx.request
        .body as leasing.v1.RentalObjectAvailabilitiesRequest

      const result = await leasingAdapter.getRentalObjectAvailabilities(
        body.rentalObjectCodes ?? [],
        body.rentAtByRentalObjectCode
      )

      if (!result.ok && result.err === 'availabilities-not-found') {
        ctx.status = 404
        ctx.body = { error: 'Availabilities not found', ...metadata }
        return
      } else if (!result.ok && result.err === 'invalid-request') {
        ctx.status = 400
        ctx.body = { error: 'invalid-request', ...metadata }
        return
      } else if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error:
            'Unexpected error when getting availabilities for ' +
            (body.rentalObjectCodes?.join(', ') ?? ''),
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )
}
