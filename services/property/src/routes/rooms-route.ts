import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getRoomById, getRooms } from '../adapters/room-adapter'
import { roomsQueryParamsSchema } from '../types/room'
import { generateMetaLinks } from '../utils/links'

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
      const rooms = await getRooms(buildingCode, floorCode, residenceCode)
      ctx.body = {
        content: rooms.map((room) => ({
          ...room,
          _links: {
            self: {
              href: `/rooms/${room.id}`,
            },
            residence: {
              href: `/residences/${residenceCode}`,
            },
            building: {
              href: `/buildings/${buildingCode}`,
            },
            parent: {
              href: `/residences/${residenceCode}`,
            },
          },
        })),
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
    logger.info(`GET /rooms/${id}`, metadata)

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
