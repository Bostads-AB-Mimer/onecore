import KoaRouter from '@koa/router'
import { getMaintenanceUnitsByRentalPropertyId } from '@src/adapters/maintenance-units-adapter'
import { MaintenanceUnitSchema } from '@src/types/maintenance-unit'
import { generateRouteMetadata, logger } from 'onecore-utilities'

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
   * /maintenance-units/by-rental-property/{id}:
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
  router.get('(.*)/maintenance-units/by-rental-property/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /maintenance-units/by-rental-property/${id}`, metadata)

    try {
      const response = await getMaintenanceUnitsByRentalPropertyId(id)

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
}
