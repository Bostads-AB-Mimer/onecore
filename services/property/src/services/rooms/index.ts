import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getRooms } from '../../adapters/room-adapter'

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
   *   /rooms/buildingCode/{buildingCode}/staircase/{floorCode}/residenceCode/{residenceCode}:
   *     get:
   *       summary: Get rooms by building and residence code.
   *       description: Returns all rooms belonging to a specific building and residence code.
   *       tags:
   *         - Rooms
   *       parameters:
   *         - in: path
   *           name: buildingCode
   *           required: true
   *           description: The building code of the building for the residence.
   *           schema:
   *             type: string
   *         - in: path
   *           name: floorCode
   *           required: true
   *           description: The floor code of the staircase.
   *           schema:
   *             type: string
   *         - in: path
   *           name: residenceCode
   *           required: true
   *           description: The residence code where the rooms are located.
   *           schema:
   *             type: string
   *       responses:
   *         200:
   *           description: Successfully retrieved the rooms.
   */

  router.get(
    '(.*)/rooms/buildingCode/:buildingCode/staircase/:floorCode/residenceCode/:residenceCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { buildingCode, floorCode, residenceCode } = ctx.params
      logger.info(
        `GET /rooms/buildingCode/${buildingCode}/staircase/${floorCode}/residenceCode/${residenceCode}`,
        metadata
      )

      if (!buildingCode || buildingCode.length < 7) {
        ctx.status = 400
        ctx.body = { content: 'Invalid building code', ...metadata }
        return
      }

      const parsedBuildingCode = buildingCode.slice(0, 7)

      try {
        const response = await getRooms(
          parsedBuildingCode,
          floorCode,
          residenceCode
        )
        ctx.body = { content: response, ...metadata }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )
}
