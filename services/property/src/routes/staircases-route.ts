/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getStaircasesByBuildingCode } from '../adapters/staircase-adapter'
import { staircasesQueryParamsSchema } from '../types/staircase'

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
   * /staircases:
   *   get:
   *     summary: Gets staircases belonging to a building by building code
   *     description: Returns the staircases belonging to the building.
   *     tags:
   *       - Staircases
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *     responses:
   *       200:
   *         description: Successfully retrieved the staircases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Staircase'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(['(.*)/staircases'], async (ctx) => {
    const queryParams = staircasesQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { buildingCode } = queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /staircases?buildingCode=${buildingCode}`, metadata)

    try {
      const response = await getStaircasesByBuildingCode(buildingCode)
      const responseContent = response.map((staircase) => {
        return {
          ...staircase,
          _links: {
            self: { href: `/staircases/${staircase.id}` },
            building: { href: `/buildings/${staircase.buildingCode}` },
            residences: {
              href: `/residences?buildingCode=${staircase.buildingCode}`,
            },
            parent: { href: `/buildings/${staircase.buildingCode}` },
          },
        }
      })

      ctx.body = {
        content: responseContent,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  //todo: add staircases details GET
  //todo: the details data will be quote identical to the one in the list GET because of the data model
}
