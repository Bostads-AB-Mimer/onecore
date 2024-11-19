import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getResidencesByType, getLatestResidences, getResidenceById } from '../../adapters/residence-adapter'
import { Residence } from '../../types/residence'
import { mapDbToResidence } from './residence-mapper'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Residences
 *     description: Operations related to residences
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /residences/latest/:
   *   get:
   *     summary: Gets a list of residences.
   *     description: Returns the residences for the relevant type ID.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: residenceType
   *         required: false
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
   * /residences/:
   *   get:
   *     summary: Gets a list of residences.
   *     description: Returns residences filtered by type if a residence type is provided; otherwise, returns the latest residences.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: residenceType
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional filter for the type of residences to retrieve.
   *     responses:
   *       200:
   *         description: Successfully retrieved residences data.
   *         content:
   */

  router.get('(.*)/residences/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /residences/:residenceTypeId/', metadata)
    let response
    if (ctx.query.residenceType) {
      response = await getResidencesByType(ctx.query.residenceType)
    } else {
      response = await getLatestResidences()
    }
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /residences/{id}:
   *   get:
   *     summary: Get a residence by ID.
   *     description: Returns a residence with the specified ID.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence.
   *     responses:
   *       200:
   *         description: Successfully retrieved the residence.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 code:
   *                   type: string
   *                 name:
   *                   type: string
   *                 roomCount:
   *                   type: integer
   *                 kitchen:
   *                   type: integer
   *                 selectionFundAmount:
   *                   type: number
   */
  router.get('(.*)/residences/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /residences/${ctx.params.id}`, metadata)
    const dbRecord = await getResidenceById(ctx.params.id)
    const response: Residence = mapDbToResidence(dbRecord)
    ctx.body = { content: response, ...metadata }
  })
}
