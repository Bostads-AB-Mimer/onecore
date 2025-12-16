import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { registerSchema } from '../../middlewares/swagger-middleware'
import {
  GetInspectionsFromXpandQuerySchema,
  XpandInspectionSchema,
} from './schemas'
import * as xpandAdapter from './adapters/xpand-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Inspection
 *     description: Operations related to inspections (Besiktning)
 */

export const routes = (router: KoaRouter) => {
  registerSchema('XpandInspection', XpandInspectionSchema)

  /**
   * @swagger
   * /inspections/xpand:
   *   get:
   *     tags:
   *       - Inspection
   *     summary: Get inspections from Xpand
   *     parameters:
   *       - in: query
   *         name: skip
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of records to skip for pagination.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *         description: Maximum number of records to return.
   *       - in: query
   *         name: sortAscending
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Whether to sort the results in ascending order.
   *     responses:
   *       200:
   *         description: A list of inspections from Xpand
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     inspections:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandInspection'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       500:
   *         description: Internal Server Error - Failed to fetch inspections from Xpand
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   */
  router.get('(.*)/inspections/xpand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedQuery = GetInspectionsFromXpandQuerySchema.safeParse(ctx.query)
    if (!parsedQuery.success) {
      ctx.status = 400
      ctx.body = {
        error: parsedQuery.error,
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedQuery.data

    try {
      const xpandInspections = await xpandAdapter.getInspectionsFromXpand({
        skip,
        limit,
        sortAscending,
      })

      if (!xpandInspections.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch inspections from Xpand: ${xpandInspections.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: {
          inspections: xpandInspections.data,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error fetching inspections from Xpand')
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })
}
