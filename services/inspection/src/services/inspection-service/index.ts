import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  buildPaginatedResponse,
} from '@onecore/utilities'
import { registerSchema } from '../../middlewares/swagger-middleware'
import {
  DetailedXpandInspectionSchema,
  GetInspectionsFromXpandQuerySchema,
  GetInspectionsByResidenceIdQuerySchema,
  XpandInspectionSchema,
} from './schemas'
import * as xpandAdapter from './adapters/xpand-adapter'
import * as dbAdapter from './adapters/db-adapter'
import { CreateInspectionSchema } from './adapters/db-adapter/schemas'
import { db } from './adapters/db'

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
  registerSchema('CreateInspection', CreateInspectionSchema)

  /**
   * @swagger
   * /inspections/xpand:
   *   get:
   *     tags:
   *       - Inspection
   *     summary: Get inspections from Xpand
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for pagination.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 25
   *         description: Maximum number of records to return.
   *       - in: query
   *         name: statusFilter
   *         schema:
   *           type: string
   *           enum: [ongoing, completed]
   *         description: Filter inspections by status (ongoing or completed).
   *       - in: query
   *         name: sortAscending
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Whether to sort the results in ascending order.
   *       - in: query
   *         name: inspector
   *         schema:
   *           type: string
   *         description: Filter inspections by inspector name.
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Filter inspections by address.
   *     responses:
   *       200:
   *         description: A paginated list of inspections from Xpand
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/XpandInspection'
   *                 _meta:
   *                   type: object
   *                   properties:
   *                     totalRecords:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     count:
   *                       type: integer
   *                 _links:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       href:
   *                         type: string
   *                       rel:
   *                         type: string
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

    const { page, limit, statusFilter, sortAscending, inspector, address } =
      parsedQuery.data

    try {
      const xpandInspections = await xpandAdapter.getInspections({
        page,
        limit,
        statusFilter,
        sortAscending,
        inspector,
        address,
      })

      if (!xpandInspections.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch inspections from Xpand: ${xpandInspections.err}`,
          ...metadata,
        }
        return
      }

      const { inspections, totalRecords } = xpandInspections.data

      const additionalParams: Record<string, string> = {}
      if (statusFilter) additionalParams.statusFilter = statusFilter
      if (sortAscending !== undefined)
        additionalParams.sortAscending = String(sortAscending)
      if (inspector) additionalParams.inspector = inspector
      if (address) additionalParams.address = address

      ctx.status = 200
      ctx.body = buildPaginatedResponse({
        content: inspections,
        totalRecords,
        ctx,
        additionalParams,
        defaultLimit: 25,
      })
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
   *       - in: query
   *         name: statusFilter
   *         schema:
   *           type: string
   *           enum: [ongoing, completed]
   *         description: Filter inspections by status (ongoing or completed).
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

    const parsedQuery = GetInspectionsByResidenceIdQuerySchema.safeParse(
      ctx.query
    )
    const statusFilter = parsedQuery.success
      ? parsedQuery.data.statusFilter
      : undefined

    try {
      const xpandInspections = await xpandAdapter.getInspectionsByResidenceId(
        residenceId,
        statusFilter
      )

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

  /**
   * @swagger
   * /inspections/internal/residence/{residenceId}:
   *   get:
   *     tags:
   *       - Inspection
   *     summary: Get inspections from local database by residence ID
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence to fetch inspections for
   *       - in: query
   *         name: statusFilter
   *         schema:
   *           type: string
   *           enum: [ongoing, completed]
   *         description: Filter inspections by status (ongoing or completed).
   *     responses:
   *       200:
   *         description: A list of inspections for the specified residence from local database
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
   *         description: Internal Server Error - Failed to fetch inspections
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
  router.get(
    '(.*)/inspections/internal/residence/:residenceId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { residenceId } = ctx.params

      const parsedQuery = GetInspectionsByResidenceIdQuerySchema.safeParse(
        ctx.query
      )
      const statusFilter = parsedQuery.success
        ? parsedQuery.data.statusFilter
        : undefined

      try {
        const result = await dbAdapter.getInspectionsByResidenceId(
          db,
          residenceId,
          statusFilter
        )

        if (!result.ok) {
          ctx.status = 500
          ctx.body = {
            error: `Failed to fetch inspections: ${result.err}`,
            ...metadata,
          }
          return
        }

        ctx.status = 200
        ctx.body = {
          content: {
            inspections: result.data,
          },
          ...metadata,
        }
      } catch (error) {
        logger.error(
          error,
          `Error fetching inspections for residenceId: ${residenceId}`
        )
        ctx.status = 500

        if (error instanceof Error) {
          ctx.body = {
            error: error.message,
            ...metadata,
          }
        }
      }
    }
  )

  /**
   * @swagger
   * /inspections/internal:
   *   get:
   *     tags:
   *       - Inspection
   *     summary: Get inspections from local database
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for pagination.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 25
   *         description: Maximum number of records to return.
   *       - in: query
   *         name: statusFilter
   *         schema:
   *           type: string
   *           enum: [ongoing, completed]
   *         description: Filter inspections by status (ongoing or completed).
   *       - in: query
   *         name: sortAscending
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Whether to sort the results in ascending order.
   *       - in: query
   *         name: inspector
   *         schema:
   *           type: string
   *         description: Filter inspections by inspector name.
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Filter inspections by address.
   *     responses:
   *       200:
   *         description: A paginated list of inspections from local database
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/XpandInspection'
   *                 _meta:
   *                   type: object
   *                   properties:
   *                     totalRecords:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     count:
   *                       type: integer
   *                 _links:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       href:
   *                         type: string
   *                       rel:
   *                         type: string
   *       500:
   *         description: Internal Server Error - Failed to fetch inspections
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
  router.get('(.*)/inspections/internal', async (ctx) => {
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

    const { page, limit, statusFilter, sortAscending, inspector, address } =
      parsedQuery.data

    try {
      const result = await dbAdapter.getInspections(db, {
        page,
        limit,
        statusFilter,
        sortAscending,
        inspector,
        address,
      })

      if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch inspections: ${result.err}`,
          ...metadata,
        }
        return
      }

      const { inspections, totalRecords } = result.data

      const additionalParams: Record<string, string> = {}
      if (statusFilter) additionalParams.statusFilter = statusFilter
      if (sortAscending !== undefined)
        additionalParams.sortAscending = String(sortAscending)
      if (inspector) additionalParams.inspector = inspector
      if (address) additionalParams.address = address

      ctx.status = 200
      ctx.body = buildPaginatedResponse({
        content: inspections,
        totalRecords,
        ctx,
        additionalParams,
        defaultLimit: 25,
      })
    } catch (error) {
      logger.error(error, 'Error fetching inspections from local database')
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
   * /inspections:
   *   post:
   *     tags:
   *       - Inspection
   *     summary: Create a new inspection
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateInspection'
   *     responses:
   *       201:
   *         description: Inspection created successfully
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
   *       400:
   *         description: Invalid request body
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                 details:
   *                   type: array
   *                 metadata:
   *                   type: object
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                 metadata:
   *                   type: object
   */
  router.post('(.*)/inspections', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const validationResult = CreateInspectionSchema.safeParse(ctx.request.body)
    if (!validationResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        details: validationResult.error.errors,
        ...metadata,
      }
      return
    }

    try {
      const result = await dbAdapter.createInspection(db, validationResult.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to create inspection: ${result.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 201
      ctx.body = {
        content: {
          inspection: result.data,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error creating inspection')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
