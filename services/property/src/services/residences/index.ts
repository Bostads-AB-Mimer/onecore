import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getResidenceById,
  getResidencesByBuildingCode,
  getResidencesByBuildingCodeAndFloorCode,
} from '../../adapters/residence-adapter'
import { mapDbToResidence } from './residence-mapper'
import { residencesQueryParamsSchema } from '../../types/residence'

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
   * /residences:
   *   get:
   *     summary: Get residences by building code, optionally filtered by floor code.
   *     description: Returns all residences belonging to a specific building, optionally filtered by floor code.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *       - in: query
   *         name: floorCode
   *         required: false
   *         schema:
   *           type: string
   *         description: The floor code of the staircase (optional).
   *     responses:
   *       200:
   *         description: Successfully retrieved the residences.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Residence'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(['(.*)/residences', '(.*)/residences/'], async (ctx) => {
    const queryParams = residencesQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { buildingCode, floorCode } = queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /residences?buildingCode=${buildingCode}${
        floorCode ? `&floorCode=${floorCode}` : ''
      }`,
      metadata
    )

    try {
      let response

      if (floorCode) {
        response = await getResidencesByBuildingCodeAndFloorCode(
          buildingCode,
          floorCode
        )
      } else {
        response = await getResidencesByBuildingCode(buildingCode)
      }

      ctx.body = {
        content: response,
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
    const id = ctx.params.id
    logger.info(`GET /residences/${id}`, metadata)
    const dbRecord = await getResidenceById(id)
    if (!dbRecord) {
      ctx.status = 404
      return
    }
    console.log('dbRecord', dbRecord)
    const response = mapDbToResidence(dbRecord)
    ctx.body = { content: response, ...metadata }
  })
}
