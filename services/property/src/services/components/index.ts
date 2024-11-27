/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getComponentByMaintenanceUnitCode } from '../../adapters/component-adapter'

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
   * /components/:
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
   *         description: The unique code identifying the maintenance unit
   *     responses:
   *       200:
   *         description: |
   *           Successfully retrieved the components list. Returns an array of component objects
   *           containing details like ID, code, name, manufacturer, installation date, etc.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ComponentList'
   *       400:
   *         description: Invalid maintenance unit code provided
   *       404:
   *         description: No components found for the specified maintenance unit
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/components/:maintenanceUnitCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /components/:maintenanceUnitCode/', metadata)
    const response = await getComponentByMaintenanceUnitCode(ctx.params.maintenanceUnit)
    ctx.body = { content: response, ...metadata }
  })
}
