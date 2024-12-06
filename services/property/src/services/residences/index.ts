import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getLatestResidences,
  getResidenceById,
  getResidencesByBuildingCode,
  getResidencesByBuildingCodeAndFloorCode,
} from '../../adapters/residence-adapter'
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
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Residence'
   */

  router.get('(.*)/residences/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /residences/:residenceTypeId/', metadata)
    const propertyCode = ctx.query.propertyCode?.toString()
    const response = await getLatestResidences(propertyCode)
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
    const response = mapDbToResidence(dbRecord)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   *   /residences/buildingCode/{buildingCode}:
   *     get:
   *       summary: Get residences by building code.
   *       description: Returns all residences belonging to a specific building by building code.
   *       tags:
   *         - Residences
   *       parameters:
   *         - in: path
   *           name: buildingCode
   *           required: true
   *           schema:
   *             type: string
   *           description: The building code of the building.
   *       responses:
   *         200:
   *           description: Successfully retrieved the residencies.
   *           content:
   *             application/json:
   *               schema:
   *                 type: object
   *                 properties:
   *                   content:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/Residence'
   */
  router.get('(.*)/residences/buildingCode/:buildingCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /residences/buildingCode/${ctx.params.buildingCode}`,
      metadata
    )

    const { buildingCode } = ctx.params

    if (!buildingCode || buildingCode.length < 7) {
      ctx.status = 400
      ctx.body = { content: 'Invalid building code', ...metadata }
      return
    }

    const parsedBuildingCode = buildingCode.slice(0, 7)

    try {
      const response = await getResidencesByBuildingCode(parsedBuildingCode)
      ctx.body = { content: response, ...metadata }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   *   /residences/buildingCode/{buildingCode}/staircase/{floorCode}:
   *     get:
   *       summary: Get residences by building and staircase code.
   *       description: Returns all residences belonging to a specific building and staircase.
   *       tags:
   *         - Residences
   *       parameters:
   *         - in: path
   *           name: buildingCode
   *           required: true
   *           description: The building code of the building.
   *           schema:
   *             type: string
   *         - in: path
   *           name: floorCode
   *           required: true
   *           description: The floor code of the staircase.
   *           schema:
   *             type: string
   *       responses:
   *         200:
   *           description: Successfully retrieved the residences.
   *           content:
   *             application/json:
   *               schema:
   *                 type: object
   *                 properties:
   *                   content:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/Residence'
   */
  router.get(
    '(.*)/residences/buildingCode/:buildingCode/staircase/:floorCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { buildingCode, floorCode } = ctx.params
      logger.info(
        `GET /residences/buildingCode/${buildingCode}/staircase/${floorCode}`,
        metadata
      )

      if (!buildingCode || buildingCode.length < 7) {
        ctx.status = 400
        ctx.body = { content: 'Invalid building code', ...metadata }
        return
      }

      const parsedBuildingCode = buildingCode.slice(0, 7)

      try {
        const response = await getResidencesByBuildingCodeAndFloorCode(
          parsedBuildingCode,
          floorCode
        )
        ctx.body = { content: response, ...metadata }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )
}
