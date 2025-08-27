import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import {
  getAllVacantParkingSpaces,
  getParkingSpace,
  getParkingSpaces,
} from '../adapters/xpand/rental-object-adapter'

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
   *   get:
   *     summary: Get parking spaces by codes
   *     description: Fetches parking spaces filtered by includeRentalObjectCodes.
   *     tags:
   *       - RentalObject
   *     parameters:
   *       - in: query
   *         name: includeRentalObjectCodes
   *         schema:
   *           type: string
   *         description: Comma-separated list of rental object codes to include.
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
  router.get('(.*)/parking-spaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    // TODO: Receive rentalObjectCodes as array from body instead of query params

    const codesParam = ctx.query.includeRentalObjectCodes as string | undefined
    const includeRentalObjectCodes = codesParam
      ? codesParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined
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
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
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
}
