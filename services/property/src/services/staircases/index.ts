/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {getStaircasesByBuildingCode} from "../../adapters/staircase-adapter";

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Staircases
 *     description: Operations related to staircases
 */

export const routes = (router: KoaRouter) => {

  /**
   * @swagger
   * /staircases/{buildingCode}/:
   *   get:
   *     summary: Gets staircases belonging to a building by building code
   *     description: Returns the staircases belonging to the building.
   *     tags:
   *       - Staircases
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *     responses:
   *       200:
   *         description: Successfully retrieved the staircases.
   *         content:
   */
  router.get('(.*)/staircases/:buildingCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /staircases/${ctx.params.buildingCode}/`, metadata)

    const { buildingCode } = ctx.params

    if (!buildingCode || buildingCode.length < 7) {
      ctx.status = 400
      ctx.body = { content: 'Invalid building code', ...metadata }
      return
    }

    const parsedBuildingCode = buildingCode.slice(0, 7)

    try {
      const response = await getStaircasesByBuildingCode(parsedBuildingCode)
      ctx.body = { content: response, ...metadata }
    } catch (err){
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error';
      ctx.body = {reason: errorMessage, ...metadata}
    }
  })
}
