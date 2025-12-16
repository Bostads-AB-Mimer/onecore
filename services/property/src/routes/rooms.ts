import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'

import { getRoomById, getRooms } from '@src/adapters/room-adapter'
import { Room, roomsQueryParamsSchema } from '@src/types/room'
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
        const mapped = rooms.map(
          (v): Room => ({
            ...v,
            deleted: Boolean(v.deleteMark),
            area: v.propertyObject?.quantityValues?.find(
              (qv) => qv.quantityTypeId === 'NTA'
            )?.value,
            dates: {
              availableFrom: v.availableFrom,
              availableTo: v.availableTo,
              from: v.fromDate,
              to: v.toDate,
              installation: v.installationDate,
            },
            features: {
              hasThermostatValve: Boolean(v.hasThermostatValve),
              hasToilet: Boolean(v.hasToilet),
              isHeated: Boolean(v.isHeated),
              orientation: v.orientation,
            },
            usage: {
              allowPeriodicWorks: Boolean(v.allowPeriodicWorks),
              shared: Boolean(v.sharedUse),
              spaceType: v.spaceType,
            },
          })
        )
        ctx.body = {
          content: mapped,
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

      const mappedRoom: Room = {
        ...room,
        deleted: Boolean(room.deleteMark),
        area: room.propertyObject?.quantityValues?.find(
          (qv) => qv.quantityTypeId === 'NTA'
        )?.value,
        dates: {
          availableFrom: room.availableFrom,
          availableTo: room.availableTo,
          from: room.fromDate,
          to: room.toDate,
          installation: room.installationDate,
        },
        features: {
          hasThermostatValve: Boolean(room.hasThermostatValve),
          hasToilet: Boolean(room.hasToilet),
          isHeated: Boolean(room.isHeated),
          orientation: room.orientation,
        },
        usage: {
          allowPeriodicWorks: Boolean(room.allowPeriodicWorks),
          shared: Boolean(room.sharedUse),
          spaceType: room.spaceType,
        },
      }

      ctx.body = {
        content: mappedRoom,
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
