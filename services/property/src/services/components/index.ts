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
   *     summary: Gets a list of components.
   *     description: Returns the component for the relevant unit code.
   *     tags:
   *       - Components
   *     parameters:
   *       - in: query
   *         name: maintenanceUnit
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the maintenance unit.
   *     responses:
   *       200:
   *         description: Successfully retrieved the components.
   *         content:
   */
  router.get('(.*)/components/:maintenanceUnitCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /components/:maintenanceUnitCode/', metadata)
    const response = await getComponentByMaintenanceUnitCode(ctx.params.maintenanceUnit)
    ctx.body = { content: response, ...metadata }
  })
}
