/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { z } from 'zod'

import {
  getBuildingByCode,
  getBuildingById,
  getBuildings,
  searchBuildings,
} from '../adapters/building-adapter'
import { buildingsQueryParamsSchema, BuildingSchema } from '../types/building'
import { parseRequest } from '../middleware/parse-request'
import { transformBuildingData } from '../utils/buildings'

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
  router.get(
    ['(.*)/buildings', '(.*)/buildings/'],
    parseRequest({
      query: buildingsQueryParamsSchema,
    }),
    async (ctx) => {
      const { propertyCode } = ctx.request.parsedQuery

      const metadata = generateRouteMetadata(ctx)
      logger.info(`GET /buildings?propertyCode=${propertyCode}`, metadata)

      try {
        const buildings = await getBuildings(propertyCode)

        const responseContent = buildings.map((building) => {
          const parsedBuilding = BuildingSchema.parse(
            transformBuildingData(building)
          )

          return parsedBuilding
        })

        ctx.body = {
          content: responseContent,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /buildings/search:
   *   get:
   *     summary: Search buildings
   *     description: |
   *       Retrieves all buildings associated with a given name.
   *       Returns detailed information about each building including its code, name,
   *       construction details, and associated property information.
   *     tags:
   *       - Buildings
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: The search query.
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

  const BuildingSearchQueryParamsSchema = z.object({
    q: z.string().min(3),
  })

  router.get(
    '(.*)/buildings/search',
    parseRequest({ query: BuildingSearchQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const buildings = await searchBuildings(ctx.request.parsedQuery.q)
        const responseContent = buildings.map(
          (b): z.infer<typeof BuildingSchema> => ({
            id: b.id,
            code: b.buildingCode,
            name: b.name || '',
            buildingType: {
              id: b.buildingType?.id || '',
              code: b.buildingType?.code || '',
              name: b.buildingType?.name || '',
            },
            construction: {
              constructionYear: b.constructionYear,
              renovationYear: b.renovationYear,
              valueYear: b.valueYear,
            },
            features: {
              heating: b.heating || '',
              fireRating: b.fireRating || '',
            },
            insurance: {
              class: b.insuranceClass,
              value: b.insuranceValue,
            },
            deleted: Boolean(b.deleteMark),
            property: b.property,
          })
        )

        ctx.body = {
          content: responseContent,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /buildings/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get detailed information about a specific building by building code
   *     description: |
   *       Retrieves comprehensive information about a building using its building code.
   *       Returns details including construction year, renovation history, insurance information,
   *       and associated property data.
   *     tags:
   *       - Buildings
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building
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
   *       404:
   *         description: Building not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/buildings/by-building-code/:buildingCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const buildingCode = ctx.params.buildingCode
    logger.info(`GET /buildings/by-building-code/${buildingCode}`, metadata)

    try {
      const building = await getBuildingByCode(buildingCode)

      if (!building) {
        ctx.status = 404
        return
      }

      const transformedData = transformBuildingData(building)

      ctx.body = {
        content: BuildingSchema.parse(transformedData),
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

      const transformedData = transformBuildingData(building)

      ctx.body = {
        content: BuildingSchema.parse(transformedData),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
