import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { registerSchema } from '../../middlewares/swagger-middleware'
import {
  DetailedXpandInspectionSchema,
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
  registerSchema('DetailedXpandInspection', DetailedXpandInspectionSchema)
  registerSchema('DetailedXpandInspectionRoom', DetailedXpandInspectionSchema)
  registerSchema('DetailedXpandInspectionRemark', DetailedXpandInspectionSchema)

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
      const xpandInspections = await xpandAdapter.getInspections({
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

  /**
   * @swagger
   * /inspections/xpand/residence/{residenceId}:
   *   get:
   *     tags:
   *       - Inspection
   *     summary: Get inspections from Xpand by residence ID
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence to fetch inspections for
   *     responses:
   *       200:
   *         description: A list of inspections for the specified residence from Xpand
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
  router.get('(.*)/inspections/xpand/residence/:residenceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { residenceId } = ctx.params

    try {
      const xpandInspections =
        await xpandAdapter.getInspectionsByResidenceId(residenceId)

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
      logger.error(
        error,
        `Error fetching inspections from Xpand for residenceId: ${residenceId}`
      )
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /inspections/xpand/{inspectionId}:
   *   get:
   *     tags:
   *       - Inspection
   *     summary: Get a detailed inspection from Xpand by inspection ID
   *     parameters:
   *       - in: path
   *         name: inspectionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the inspection to fetch
   *     responses:
   *       200:
   *         description: The inspection details from Xpand
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     inspection:
   *                       $ref: '#/components/schemas/DetailedXpandInspection'
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
  router.get('(.*)/inspections/xpand/:inspectionId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { inspectionId } = ctx.params

    try {
      const xpandInspection = await xpandAdapter.getInspectionById(inspectionId)

      if (!xpandInspection.ok) {
        if (xpandInspection.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: `Inspection with ID ${inspectionId} not found`,
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch inspection from Xpand: ${xpandInspection.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: {
          inspection: xpandInspection.data,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error(
        error,
        `Error fetching inspection from Xpand for inspectionId: ${inspectionId}`
      )
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
