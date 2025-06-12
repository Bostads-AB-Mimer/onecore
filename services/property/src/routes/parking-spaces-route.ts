import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import * as leaseAdapter from '../adapters/lease-adapter'
import * as parkingSpacesAdapter from '../adapters/parking-spaces-adapter'
import { getRentalPropertyIdFromLeaseId } from '@src/utils/leases'
import { ParkingSpaceSchema } from '@src/types/parking-space'

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
   * /parking-spaces/by-lease-id/{id}:
   *   get:
   *     summary: Gets a list of parking space by lease id
   *     description: |
   *       Retrieves parking space from lease id.
   *     tags:
   *       - Parking Spaces
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The lease id.
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
  router.get('(.*)/parking-spaces/by-lease-id/:id', async (ctx) => {
    const id = ctx.params.id
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /parking-spaces/by-lease-id/${id}`, metadata)

    try {
      // 1. Fetch the lease by lease id to check if it exists or not
      const lease = await leaseAdapter.getLeaseById(id)

      if (!lease) {
        ctx.status = 404
        ctx.body = {
          reason: 'No lease found for the specified lease id',
          ...metadata,
        }
        return
      }

      // 2. Extract the rental property id from the lease id the same way as in the lease service (string parsing).
      const rentalPropertyId = getRentalPropertyIdFromLeaseId(
        lease.contractNumber
      )

      // 3. Fetch the parking space associated With the rental property id (hyresid).
      const parkingSpace =
        await parkingSpacesAdapter.getParkingSpaceByRentalPropertyId(
          rentalPropertyId
        )

      if (!parkingSpace) {
        ctx.status = 404
        ctx.body = {
          reason: 'No parking space found for the specified lease id',
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
      logger.error({ err }, 'Error fetching parking space by leaseId')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
