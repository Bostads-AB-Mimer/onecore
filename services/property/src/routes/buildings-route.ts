/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getBuildingById, getBuildings } from '../adapters/building-adapter'
import { buildingsQueryParamsSchema } from '../types/building'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Buildings
 *     description: Operations related to buildings
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /buildings:
   *   get:
   *     summary: Get all buildings for a specific property
   *     description: |
   *       Retrieves all buildings associated with a given property code.
   *       Returns detailed information about each building including its code, name,
   *       construction details, and associated property information.
   *     tags:
   *       - Buildings
   *     parameters:
   *       - in: query
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the property.
   *     responses:
   *       200:
   *         description: Successfully retrieved the buildings.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Building'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(['(.*)/buildings', '(.*)/buildings/'], async (ctx) => {
    const queryParams = buildingsQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { propertyCode } = queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /buildings?propertyCode=${propertyCode}`, metadata)

    try {
      const buildings = await getBuildings(propertyCode)

      ctx.body = {
        content: buildings.map((building) => ({
          ...building,
          _links: {
            self: {
              href: `/buildings/${building.id}`,
            },
            property: {
              href: `/properties/${propertyCode}`,
            },
            residences: {
              href: `/residences?buildingCode=${building.buildingCode}`,
            },
            staircases: {
              href: `/staircases?buildingCode=${building.id}`,
            },
            parent: {
              href: `/properties?propertyCode=${propertyCode}`,
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
   * /buildings/{id}:
   *   get:
   *     summary: Get detailed information about a specific building
   *     description: |
   *       Retrieves comprehensive information about a building using its unique building code.
   *       Returns details including construction year, renovation history, insurance information,
   *       and associated property data. The building code must be at least 7 characters long.
   *     tags:
   *       - Buildings
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           minLength: 7
   *         description: The unique id of the building
   *     responses:
   *       200:
   *         description: Successfully retrieved building information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Building'
   *       400:
   *         description: Invalid building code format
   *       404:
   *         description: Building not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/buildings/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /buildings/${id}`, metadata)

    try {
      const building = await getBuildingById(id)

      if (!building) {
        ctx.status = 404
        return
      }

      ctx.body = {
        content: building,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
