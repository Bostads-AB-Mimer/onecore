import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import * as parkingSpacesAdapter from '../adapters/parking-spaces-adapter'
import { ParkingSpaceSchema } from '@src/types/parking-space'
import { trimStrings } from '@src/utils/data-conversion'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Parking Spaces
 *     description: Operations related to parking spaces
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /parking-spaces/by-rental-id/{id}:
   *   get:
   *     summary: Gets a list of parking space by rental id
   *     description: |
   *       Retrieves parking space from rental id.
   *     tags:
   *       - Parking Spaces
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental id.
   *     responses:
   *       200:
   *         description: |
   *           Successfully retrieved the parking space. Returns parking space object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ParkingSpace'
   *       400:
   *         description: Invalid id provided
   *       404:
   *         description: No parking spaces found for the specified id
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/parking-spaces/by-rental-id/:id', async (ctx) => {
    const id = ctx.params.id
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /parking-spaces/by-rental-id/${id}`, metadata)

    try {
      // Fetch the parking space associated with the rental property id
      const parkingSpace = await parkingSpacesAdapter
        .getParkingSpaceByRentalPropertyId(id)
        .then(trimStrings)

      if (!parkingSpace) {
        ctx.status = 404
        ctx.body = {
          reason: 'No parking space found for the specified rental id',
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: ParkingSpaceSchema.parse(parkingSpace),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'Error fetching parking space by rental id')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
