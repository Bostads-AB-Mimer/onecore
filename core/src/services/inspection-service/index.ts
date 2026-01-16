import KoaRouter from '@koa/router'

import * as inspectionAdapter from '../../adapters/inspection-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
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
  registerSchema('Inspection', schemas.InspectionSchema)
  registerSchema('InspectionRoom', schemas.InspectionRoomSchema)
  registerSchema('DetailedInspection', schemas.DetailedInspectionSchema)
  registerSchema('DetailedInspectionRoom', schemas.DetailedInspectionSchema)
  registerSchema('DetailedInspectionRemark', schemas.DetailedInspectionSchema)

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
   *                         $ref: '#/components/schemas/Inspection'
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
        const inspections = result.data ?? []

        const leaseIds = inspections
          .filter(
            (inspection) =>
              inspection.leaseId !== null && inspection.leaseId !== ''
          )
          .map((inspection) => inspection.leaseId)

        const leasesById =
          leaseIds.length > 0
            ? await leasingAdapter.getLeases(leaseIds, 'true')
            : {}

        const inspectionsWithLeaseData = inspections.map((inspection) => ({
          ...inspection,
          lease: inspection.leaseId ? leasesById[inspection.leaseId] : null,
        }))

        ctx.status = 200
        ctx.body = {
          content: {
            inspections: inspectionsWithLeaseData,
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

  /**
   * @swagger
   * /inspections/xpand/residence/{residenceId}:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Retrieve inspections by residence ID from Xpand
   *     description: Retrieves inspections associated with a specific residence ID from Xpand.
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence to retrieve inspections for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved inspections for the specified residence ID.
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
   *                         $ref: '#/components/schemas/Inspection'
   *       '404':
   *         description: No inspections found for the specified residence ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: not-found
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
  router.get('/inspections/xpand/residence/:residenceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { residenceId } = ctx.params

    try {
      const result =
        await inspectionAdapter.getXpandInspectionsByResidenceId(residenceId)

      if (result.ok) {
        const leaseIds = result.data
          .filter(
            (inspection) =>
              inspection.leaseId !== null && inspection.leaseId !== ''
          )
          .map((inspection) => inspection.leaseId)

        const leasesById =
          leaseIds.length > 0
            ? await leasingAdapter.getLeases(leaseIds, 'true')
            : {}

        const inspectionsWithLeaseData = result.data.map((inspection) => ({
          ...inspection,
          lease: inspection.leaseId ? leasesById[inspection.leaseId] : null,
        }))

        ctx.status = 200
        ctx.body = {
          content: {
            inspections: inspectionsWithLeaseData,
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            residenceId,
            metadata,
          },
          'Error getting inspections by residenceId from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(
        { error, residenceId },
        'Error getting inspections by residenceId from xpand'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /inspections/xpand/{inspectionId}:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Retrieve an inspection by ID from Xpand
   *     description: Retrieves a specific inspection by its ID from Xpand.
   *     parameters:
   *       - in: path
   *         name: inspectionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the inspection to retrieve.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the inspection.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/DetailedInspection'
   *       '404':
   *         description: Inspection not found for the specified ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: not-found
   *       '500':
   *         description: Internal server error. Failed to retrieve the inspection.
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
  router.get('/inspections/xpand/:inspectionId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { inspectionId } = ctx.params

    try {
      const result =
        await inspectionAdapter.getXpandInspectionById(inspectionId)

      if (result.ok) {
        const inspection = result.data

        let lease = null
        if (inspection.leaseId) {
          lease = await leasingAdapter.getLease(inspection.leaseId, 'true')
        }

        let residence = null
        if (inspection.residenceId) {
          const res = await propertyBaseAdapter.getResidenceByRentalId(
            inspection.residenceId
          )
          if (res.ok) {
            residence = res.data
          }
        }

        ctx.status = 200
        ctx.body = {
          content: {
            ...inspection,
            lease,
            residence,
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            inspectionId,
            metadata,
          },
          'Error getting inspection by id from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(
        { error, inspectionId },
        'Error getting inspection by id from xpand'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })
}
