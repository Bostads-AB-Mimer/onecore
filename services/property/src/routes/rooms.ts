import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'

import {
  createRoom,
  deleteRoom,
  getRoomById,
  getRooms,
  getRoomsByFacilityId,
  ResidenceNotFoundError,
  RoomHasComponentsError,
  RoomNotFoundError,
} from '@src/adapters/room-adapter'
import {
  CreateRoomRequestSchema,
  roomsQueryParamsSchema,
  type CreateRoomRequest,
} from '@src/types/room'
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
   *     summary: Get rooms by rental id.
   *     description: Returns all rooms belonging to a residence.
   *     tags:
   *       - Rooms
   *     parameters:
   *       - in: query
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental id of the residence.
   *       - in: query
   *         name: roomCode
   *         required: false
   *         schema:
   *           type: string
   *         description: The code of the room (optional).
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
      const { rentalId, roomCode } = ctx.request.parsedQuery

      const metadata = generateRouteMetadata(ctx)

      try {
        const rooms = await getRooms(rentalId, roomCode)
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

  /**
   * @swagger
   * /rooms:
   *   post:
   *     summary: Create a new room in Xpand for a residence.
   *     description: |
   *       Performs a transactional 3-table write (cmobj, barum, babuf) in the
   *       Xpand DB. Returns the created room in the same shape as GET /rooms.
   *       The caller provides the parent rentalId and a curated roomTypeCode;
   *       code and caption default to auto-derived values if omitted.
   *     tags:
   *       - Rooms
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateRoomRequest'
   *     responses:
   *       201:
   *         description: Room created.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Room'
   *       400:
   *         description: Validation failure (unknown roomTypeCode, invalid caption, etc.).
   *       404:
   *         description: Residence not found for the supplied rentalId.
   *       500:
   *         description: Internal server error.
   */
  router.post(
    '(.*)/rooms',
    parseRequest({ body: CreateRoomRequestSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const input = ctx.request.parsedBody as CreateRoomRequest

      try {
        const room = await createRoom(input)
        ctx.status = 201
        ctx.body = { content: room, ...metadata }
      } catch (err) {
        if (err instanceof ResidenceNotFoundError) {
          ctx.status = 404
          ctx.body = { reason: err.message, ...metadata }
          return
        }
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /rooms/{id}:
   *   delete:
   *     summary: Delete a room in Xpand.
   *     description: |
   *       Hard-deletes the room and its supporting rows (babuf, barum, cmobj)
   *       in a single transaction. Refuses with 409 if any committed
   *       componentInstallations still reference the room — orphaning those
   *       rows would break component reads.
   *     tags:
   *       - Rooms
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the room to delete (barum.keybarum).
   *     responses:
   *       204:
   *         description: Room deleted.
   *       404:
   *         description: Room not found.
   *       409:
   *         description: Room has installed components and cannot be deleted.
   *       500:
   *         description: Internal server error.
   */
  router.delete('(.*)/rooms/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { id } = ctx.params

    try {
      await deleteRoom(id)
      ctx.status = 204
    } catch (err) {
      if (err instanceof RoomNotFoundError) {
        ctx.status = 404
        ctx.body = { reason: err.message, ...metadata }
        return
      }
      if (err instanceof RoomHasComponentsError) {
        ctx.status = 409
        ctx.body = { reason: 'room-has-components', ...metadata }
        return
      }
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
