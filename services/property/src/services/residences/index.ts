import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getResidencesByType,
  getLatestResidences,
  getResidenceById,
} from '../../adapters/residence-adapter'
import { ResidenceSchema } from '../../types/residence'
import { zodToJsonSchema } from 'zod-to-json-schema'
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
    response = await getLatestResidences()
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /residences/{id}:
   *   get:
   *     summary: Get a residence by ID
   *     description: Returns a residence with the specified ID
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence
   *         example: "_6J50WTZQ2928FJ"
   *     responses:
   *       200:
   *         description: Successfully retrieved the residence
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Residence'
   *       404:
   *         description: Residence not found
   */
  router.get('(.*)/residences/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /residences/${ctx.params.id}`, metadata)
    const dbRecord = await getResidenceById(ctx.params.id)
    if (!dbRecord) {
      ctx.status = 404
      return
    }
    console.log('dbRecord', dbRecord)
    const response: Residence = mapDbToResidence(dbRecord)
    ctx.body = { content: response, ...metadata }
  })
}
