/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getPropertyById } from '../../adapters/property-adapter'

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
   * /properties/{id}/:
   *   get:
   *     summary: Get a real estate property by ID
   *     description: Returns the property.
   *     tags:
   *       - Property base service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the rental property.
   *     responses:
   *       200:
   *         description: Successfully retrieved the property.
   *         content:
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/properties/:id/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /properties/:id/', metadata)
    const response = await getPropertyById(ctx.params.id)
    ctx.body = { content: response, ...metadata }
  })
}
