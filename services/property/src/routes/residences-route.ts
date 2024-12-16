import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getResidenceById,
  getResidencesByBuildingCode,
  getResidencesByBuildingCodeAndFloorCode,
} from '../adapters/residence-adapter'
import { residencesQueryParamsSchema } from '../types/residence'

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
      let dbResidences

      if (floorCode) {
        dbResidences = await getResidencesByBuildingCodeAndFloorCode(
          buildingCode,
          floorCode
        )
      } else {
        dbResidences = await getResidencesByBuildingCode(buildingCode)
      }

      ctx.body = {
        content: dbResidences.map((residence) => ({
          ...residence,
          _links: {
            self: {
              href: `/residences/${residence.id}`,
            },
            building: {
              href: `/buildings/${buildingCode}`,
            },
            property: {
              href: `/properties/${residence.code}`,
            },
            rooms: {
              href: `/rooms?buildingCode=${buildingCode}&residenceCode=${residence.code}`,
            },
            components: {
              href: `/components?residenceCode=${residence.code}`,
            },
            parent: {
              href: `/buildings/${buildingCode}`,
            },
          },
        })),
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
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/residences/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /residences/${id}`, metadata)

    try {
      const residence = await getResidenceById(id)
      if (!residence) {
        ctx.status = 404
        return
      }

      //todo: add room link
      ctx.body = { content: residence, ...metadata }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
