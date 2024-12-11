import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getRooms } from '../../adapters/room-adapter'
import { roomsQueryParamsSchema } from '../../types/room'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Rooms
 *     description: Operations related to rooms
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rooms:
   *   get:
   *     summary: Get rooms by building code, floor code, and residence code.
   *     description: Returns all rooms belonging to a specific building, floor, and residence code.
   *     tags:
   *       - Rooms
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building for the residence.
   *       - in: query
   *         name: floorCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The floor code of the staircase.
   *       - in: query
   *         name: residenceCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The residence code where the rooms are located.
   *     responses:
   *       200:
   *         description: Successfully retrieved the rooms.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Room'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(['(.*)/rooms', '(.*)/rooms/'], async (ctx) => {
    const queryParams = roomsQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { buildingCode, floorCode, residenceCode } = queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /rooms?buildingCode=${buildingCode}&floorCode=${floorCode}&residenceCode=${residenceCode}`,
      metadata
    )

    try {
      const response = await getRooms(buildingCode, floorCode, residenceCode)
      ctx.body = {
        content: response,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  //todo: add room details GET
}
