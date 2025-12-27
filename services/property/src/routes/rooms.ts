import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'

import {
  getRoomById,
  getRooms,
  getRoomsByFacilityId,
} from '@src/adapters/room-adapter'
import { roomsQueryParamsSchema } from '@src/types/room'
import { generateMetaLinks } from '@src/utils/links'
import { parseRequest } from '@src/middleware/parse-request'

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
   *     summary: Get rooms by residence id.
   *     description: Returns all rooms belonging to a residence.
   *     tags:
   *       - Rooms
   *     parameters:
   *       - in: query
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The id of the residence.
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
  router.get(
    '(.*)/rooms',
    parseRequest({ query: roomsQueryParamsSchema }),
    async (ctx) => {
      const { residenceId } = ctx.request.parsedQuery

      const metadata = generateRouteMetadata(ctx)

      try {
        const rooms = await getRooms(residenceId)
        ctx.body = {
          content: rooms,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /rooms/by-facility-id/{facilityId}:
   *   get:
   *     summary: Get rooms by facility id.
   *     description: Returns all rooms belonging to a facility.
   *     tags:
   *       - Rooms
   *     parameters:
   *       - in: path
   *         name: facilityId
   *         required: true
   *         schema:
   *           type: string
   *         description: The id of the facility.
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
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/rooms/by-facility-id/:facilityId', async (ctx) => {
    const { facilityId } = ctx.params
    const metadata = generateRouteMetadata(ctx)

    try {
      const rooms = await getRoomsByFacilityId(facilityId)
      ctx.body = {
        content: rooms,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /rooms/{id}:
   *   get:
   *     summary: Get a room by ID
   *     description: Returns a room with the specified ID
   *     tags:
   *       - Rooms
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the room
   *     responses:
   *       200:
   *         description: Successfully retrieved the room
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Room'
   *       404:
   *         description: Room not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/rooms/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id

    try {
      const room = await getRoomById(id)
      if (!room) {
        ctx.status = 404
        return
      }

      ctx.body = {
        content: room,
        ...metadata,
        _links: generateMetaLinks(ctx, '/rooms', {
          id: ctx.params.response,
        }),
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
