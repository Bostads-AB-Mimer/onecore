/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import {
  getComponentByMaintenanceUnitCode,
  getComponentsByRoomId,
} from '../adapters/component-adapter'
import {
  componentsQueryParamsSchema,
  ComponentSchema,
} from '../types/component'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Components
 *     description: Operations related to components
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Gets a list of components for a maintenance unit
   *     description: |
   *       Retrieves all components associated with a specific maintenance unit code.
   *       Components are returned ordered by installation date (newest first).
   *       Each component includes details about its type, category, manufacturer,
   *       and associated maintenance unit information.
   *     tags:
   *       - Components
   *     parameters:
   *       - in: query
   *         name: maintenanceUnit
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique code identifying the maintenance unit.
   *     responses:
   *       200:
   *         description: |
   *           Successfully retrieved the components list. Returns an array of component objects
   *           containing details like ID, code, name, manufacturer, installation date, etc.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Component'
   *       400:
   *         description: Invalid maintenance unit code provided
   *       404:
   *         description: No components found for the specified maintenance unit
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/components',
    parseRequest({
      query: z
        .object({
          residenceCode: z.string(),
        })
        .or(
          z.object({
            maintenanceUnit: z.string(),
          })
        ),
    }),
    async (ctx) => {
      // Add default type=residence if residenceCode is provided
      const queryWithType =
        'residenceCode' in ctx.request.parsedQuery
          ? { ...ctx.request.parsedQuery, type: 'residence' }
          : { ...ctx.request.parsedQuery, type: 'maintenance' }

      const queryParams = componentsQueryParamsSchema.parse(queryWithType)

      const metadata = generateRouteMetadata(ctx)

      try {
        let components
        if (queryParams.type === 'maintenance') {
          components = await getComponentByMaintenanceUnitCode(
            queryParams.maintenanceUnit
          )
        } else {
          components = await getComponentByMaintenanceUnitCode(
            queryParams.residenceCode
          ) // TODO: Implement getComponentByResidenceCode
        }

        if (!components) {
          ctx.status = 404
          return
        }

        ctx.body = {
          content: ComponentSchema.array().parse(components),
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
   * /components/by-room/{roomId}:
   *   get:
   *     summary: Gets a list of components for a room
   *     description: |
   *       Retrieves all components associated with a specific room ID.
   *       Components are returned ordered by installation date (newest first).
   *     tags:
   *       - Components
   *     parameters:
   *       - in: path
   *         name: roomId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the room
   *     responses:
   *       200:
   *         description: Successfully retrieved the components list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Component'
   *       404:
   *         description: Room not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/components/by-room/:roomId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Validate roomId is at most 15 characters
    const roomIdValidation = z.string().max(15).safeParse(ctx.params.roomId)
    if (!roomIdValidation.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Room ID must be at most 15 characters (Xpand format)',
        ...metadata,
      }
      return
    }

    const roomId = roomIdValidation.data

    try {
      const components = await getComponentsByRoomId(roomId)

      if (components === null) {
        ctx.status = 404
        ctx.body = { reason: 'Room not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentSchema.omit({ maintenanceUnits: true })
          .array()
          .parse(components),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
