import KoaRouter from '@koa/router'
import {
  getMaintenanceUnitsByPropertyCode,
  getMaintenanceUnitsByBuildingCode,
  getMaintenanceUnitsByRentalId,
  getMaintenanceUnitByCode,
  searchMaintenanceUnits,
} from '@src/adapters/maintenance-units-adapter'
import {
  MaintenanceUnit,
  MaintenanceUnitSchema,
} from '@src/types/maintenance-unit'
import { generateRouteMetadata, logger } from '@onecore/utilities'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Maintenance units
 *     description: Operations related to maintenance units
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /maintenance-units/by-rental-id/{id}:
   *   get:
   *     summary: Get all maintenance units for a specific rental property id
   *     description: |
   *       Retrieves all maintenance units associated with a given rental property id.
   *     tags:
   *       - Maintenance units
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the rental property for which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/maintenance-units/by-rental-id/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id

    try {
      const response = await getMaintenanceUnitsByRentalId(id)

      if (!response) {
        ctx.status = 404
        return
      }

      const responseContent = MaintenanceUnitSchema.array().parse(response)

      ctx.body = {
        content: responseContent,
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
   * /maintenance-units/by-building-code/{code}:
   *   get:
   *     summary: Get all maintenance units for a specific building code
   *     description: |
   *       Retrieves all maintenance units associated with a given building code.
   *     tags:
   *       - Maintenance units
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code for which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/maintenance-units/by-building-code/:code', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const code = ctx.params.code

    try {
      const response = await getMaintenanceUnitsByBuildingCode(code)

      if (!response) {
        ctx.status = 404
        return
      }

      ctx.body = {
        content: response satisfies MaintenanceUnit[],
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
   * /maintenance-units/by-property-code/{code}:
   *   get:
   *     summary: Get all maintenance units for a specific property code
   *     description: |
   *       Retrieves all maintenance units associated with a given property code.
   *     tags:
   *       - Maintenance units
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the property or which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/maintenance-units/by-property-code/:code', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { code } = ctx.params

    try {
      const response = await getMaintenanceUnitsByPropertyCode(code)

      if (!response) {
        ctx.status = 404
        return
      }

      ctx.body = {
        content: response satisfies MaintenanceUnit[],
        ...metadata,
      }
    } catch (err) {
      logger.error(
        `Error fetching maintenance units for property code ${code}: ${err}`
      )
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /maintenance-units/by-code/{code}:
   *   get:
   *     summary: Get a maintenance unit by its code
   *     description: |
   *       Retrieves a single maintenance unit by its unique code.
   *     tags:
   *       - Maintenance units
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the maintenance unit to retrieve.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance unit.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/MaintenanceUnit'
   *       404:
   *         description: Maintenance unit not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/maintenance-units/by-code/:code', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { code } = ctx.params

    try {
      const response = await getMaintenanceUnitByCode(code)

      if (!response) {
        ctx.status = 404
        ctx.body = { reason: 'Maintenance unit not found', ...metadata }
        return
      }

      ctx.body = {
        content: response satisfies MaintenanceUnit,
        ...metadata,
      }
    } catch (err) {
      logger.error(`Error fetching maintenance unit by code ${code}: ${err}`)
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /maintenance-units/search:
   *   get:
   *     summary: Search maintenance units
   *     description: |
   *       Searches for maintenance units by code. The search query is matched against the code using a case-insensitive contains operation. Returns up to 10 results.
   *     tags:
   *       - Maintenance units
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: The search query. Matches against maintenance unit code.
   *     responses:
   *       200:
   *         description: Successfully retrieved maintenance units matching the search query.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query provided
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/maintenance-units/search', async (ctx) => {
    const q = ctx.query.q as string
    const metadata = generateRouteMetadata(ctx)

    if (!q) {
      ctx.status = 400
      ctx.body = {
        reason: 'Query parameter "q" is required',
        ...metadata,
      }
      return
    }

    try {
      const maintenanceUnits = await searchMaintenanceUnits(q)

      ctx.status = 200
      ctx.body = {
        content: maintenanceUnits satisfies MaintenanceUnit[],
        ...metadata,
      }
    } catch (err) {
      logger.error(`Error searching maintenance units: ${err}`)
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
