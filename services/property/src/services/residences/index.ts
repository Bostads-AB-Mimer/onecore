import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getResidencesByType, getLatestResidences } from '../../adapters/residence-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Residence service
 *     description: Operations related to residences
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /residences/:
   *   get:
   *     summary: Gets a list of residences.
   *     description: Returns the residences for the relevant type ID.
   *     tags:
   *       - Residence service
   *     parameters:
   *       - in: query
   *         name: residenceType
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence type.
   *     responses:
   *       200:
   *         description: Successfully retrieved the latest residences.
   *         content:
   */
  router.get('(.*)/residences/latest', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /residences/latest', metadata)
    const response = await getLatestResidences()
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   *       200:
   *         description: Successfully retrieved the residences.
   *         content:
   */
  router.get('(.*)/residences/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /residences/:residenceTypeId/', metadata)
    const response = await getResidencesByType(ctx.query.residenceType)
    ctx.body = { content: response, ...metadata }
  })
}
