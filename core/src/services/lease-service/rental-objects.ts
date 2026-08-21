/*
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { RentalObjectRentInfo } from './schemas/lease'
import z from 'zod'

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
   *     description: Fetches availability for a rental object by Rental Object Code.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code of the availability to fetch.
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
   *                         rows:
   *                           type: array
   *                           items:
   *                             type: object
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
      const result =
        await leasingAdapter.getRentalObjectAvailabilityByCode(rentalObjectCode)

      if (!result.ok && result.err === 'availability-not-found') {
        ctx.status = 404
        ctx.body = { error: 'Availability not found', ...metadata }
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
   *     description: Fetches availabilities for rental objects by Rental Object Codes.
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
   *                           rows:
   *                             type: array
   *                             items:
   *                               type: object
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
  const RentalObjectsRentRequestSchema = z.object({
    rentalObjectCodes: z.array(z.string()).optional(),
  })
  router.post(
    '/rental-objects/availabilities',
    parseRequestBody(RentalObjectsRentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const body = ctx.request
        .body as typeof RentalObjectsRentRequestSchema._type

      const result = await leasingAdapter.getRentalObjectAvailabilities(
        body.rentalObjectCodes ?? []
      )

      if (!result.ok && result.err === 'availabilities-not-found') {
        ctx.status = 404
        ctx.body = { error: 'Availabilities not found', ...metadata }
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
