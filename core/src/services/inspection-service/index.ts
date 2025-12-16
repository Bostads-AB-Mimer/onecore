import KoaRouter from '@koa/router'

import * as inspectionAdapter from '../../adapters/inspection-adapter'
import * as schemas from './schemas'
import { registerSchema } from '../../utils/openapi'

import { logger, generateRouteMetadata } from '@onecore/utilities'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Inspection Service
 *     description: Operations related to inspections
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  registerSchema('XpandInspection', schemas.XpandInspectionSchema)

  /**
   * @swagger
   * /inspections/xpand:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Retrieve inspections from Xpand
   *     description: Retrieves inspections from Xpand with pagination support.
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
   *       '200':
   *         description: Successfully retrieved inspections.
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
   *       '400':
   *         description: Invalid query parameters.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Invalid query parameters
   *       '500':
   *         description: Internal server error. Failed to retrieve inspections.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/inspections/xpand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedParams = schemas.GetInspectionsFromXpandQuerySchema.safeParse(
      ctx.query
    )
    if (!parsedParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedParams.data

    try {
      const result = await inspectionAdapter.getXpandInspections({
        skip,
        limit,
        sortAscending,
      })

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            inspections: result.data,
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting inspections from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting inspections from xpand')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })
}
