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
 *   - name: Property base service
 *     description: Operations related to property base
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
  /**
   * @swagger
   * /components/{maintenanceUnitCode}/:
   *   get:
   *     summary: Gets a list of components.
   *     description: Returns the component for the relevant unit code.
   *     tags:
   *       - Property base service
   *     parameters:
   *       - in: path
   *         name: maintenanceUnitCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the maintenance unit.
   *     responses:
   *       200:
   *         description: Successfully retrieved the components.
   *         content:
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/components/:maintenanceUnitCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /components/:maintenanceUnitCode/', metadata)
    const response = await getComponentByMaintenanceUnitCode(
      ctx.params.maintenanceUnitCode,
    )
    ctx.body = { content: response, ...metadata }
  })
}
