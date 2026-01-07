import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import {
  getAllVacantParkingSpaces,
  getParkingSpace,
  getParkingSpaces,
} from '../adapters/xpand/rental-object-adapter'

import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'

/**
 * @swagger
 * tags:
 *   - name: Parking Spaces
 *     description: Endpoints related to parking spaces operations
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /parking-spaces:
   *   post:
   *     summary: Get parking spaces by codes
   *     description: Fetches parking spaces filtered by includeRentalObjectCodes.
   *     tags:
   *       - RentalObject
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               includeRentalObjectCodes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of rental object codes to include.
   *                 example: ["ABC123", "DEF456", "GHI789"]
   *     responses:
   *       '200':
   *         description: Successfully retrieved the parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObject'
   *       '500':
   *         description: Internal server error. Failed to fetch parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.post('(.*)/parking-spaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const requestBody = ctx.request.body as
      | { includeRentalObjectCodes?: string[] }
      | undefined
    const includeRentalObjectCodes =
      requestBody?.includeRentalObjectCodes?.filter(Boolean)

    const result = await getParkingSpaces(includeRentalObjectCodes)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
      return
    }

    if (result.err == 'parking-spaces-not-found') {
      ctx.status = 404
      ctx.body = {
        error: `No parking spaces found for rental object codes: ${includeRentalObjectCodes}`,
        ...metadata,
      }
      return
    }

    if (result.err == 'unknown') {
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching parking spaces.',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /parking-spaces/by-code/{rentalObjectCode}:
   *   get:
   *     summary: Get a parking space by rental object code
   *     description: Fetches a parking space by Rental Object Code.
   *     tags:
   *       - RentalObject
   *     responses:
   *       '200':
   *         description: Successfully retrieved the parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObject'
   *       '500':
   *         description: Internal server error. Failed to fetch parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('(.*)/parking-spaces/by-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode

    const result = await getParkingSpace(rentalObjectCode)

    if (result.ok) {
      //get rent
      const rentResult = await tenfastAdapter.getMonthlyRentForRentalObject(
        rentalObjectCode,
        false
      )

      if (rentResult.ok) {
        ctx.status = 200
        ctx.body = {
          content: { ...result.data, monthlyRent: rentResult.data },
          ...metadata,
        }
        return
      }

      logger.error(
        { err: rentResult.err, rentalObjectCode: rentalObjectCode },
        `Could not get rent from Tenfast`
      )

      //return result without rent
      ctx.status = 200
      ctx.body = { content: { ...result.data, monthlyRent: 0 }, ...metadata }
      return
    }

    if (result.err == 'parking-space-not-found') {
      ctx.status = 404
      ctx.body = {
        error: `An error occurred while fetching parking space by Rental Object Code: ${rentalObjectCode}`,
        ...metadata,
      }
      return
    }

    ctx.status = 500
    ctx.body = {
      error: 'An error occurred while fetching parking spaces.',
      ...metadata,
    }
  })

  /**
   * @swagger
   * /vacant-parkingspaces:
   *   get:
   *     summary: Get all vacant parking spaces
   *     description: Fetches a list of all vacant parking spaces available in the system.
   *     tags:
   *       - Listings
   *     responses:
   *       '200':
   *         description: Successfully retrieved the list of vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObject'
   *       '500':
   *         description: Internal server error. Failed to fetch vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(metadata, 'Fetching all vacant parking spaces')

    const vacantParkingSpaces = await getAllVacantParkingSpaces()

    if (!vacantParkingSpaces.ok) {
      logger.error(
        { err: vacantParkingSpaces.err },
        'Error fetching vacant parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching vacant parking spaces.',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { content: vacantParkingSpaces.data, ...metadata }
  })

  /**
   * @swagger
   * /rental-objects/by-code/{rentalObjectCode}/rent:
   *   get:
   *     summary: Get a rental object rent by code
   *     description: Fetches a rental object rent by Rental Object Code.
   *     tags:
   *       - RentalObject
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object rent.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 rent:
   *                   type: number
   *       '500':
   *         description: Internal server error. Failed to fetch vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *       '404':
   *         description: Not found. The rent of the specified rental object was not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('/rental-objects/by-code/:rentalObjectCode/rent', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode

    const result = await tenfastAdapter.getMonthlyRentForRentalObject(
      rentalObjectCode,
      false
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = { rent: result.data, ...metadata }
      return
    }

    if (result.err == 'could-not-find-rental-object') {
      ctx.status = 404
      ctx.body = {
        error: `Rent not found for rental object code: ${rentalObjectCode}`,
        ...metadata,
      }
      return
    }

    ctx.status = 500
    ctx.body = {
      error: 'An error occurred while fetching rental object rent.',
      ...metadata,
    }
  })
}
