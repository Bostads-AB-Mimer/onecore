/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getBuildingByCode,
  getBuildings,
} from '../../adapters/building-adapter'

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
   * /buildings/{propertyCode}/:
   *   get:
   *     summary: Get all buildings for a specific property
   *     description: |
   *       Retrieves all buildings associated with a given property code.
   *       Returns detailed information about each building including its code, name,
   *       construction details, and associated property information.
   *     tags:
   *       - Buildings
   *     parameters:
   *       - in: path
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
   *               oneOf:
   *                 - $ref: '#/components/schemas/Building'
   *                 - $ref: '#/components/schemas/BuildingList'
   */
  router.get('(.*)/buildings/:propertyCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /buildings/:propertyId/', metadata)
    const response = await getBuildings(ctx.params.propertyCode)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /buildings/byCode/{buildingCode}/:
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
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *           minLength: 7
   *         description: The unique building code (minimum 7 characters)
   *         example: "BLD1234"
   *     responses:
   *       200:
   *         description: Successfully retrieved building information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Building'
   *       400:
   *         description: Invalid building code format
   *       404:
   *         description: Building not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/buildings/byCode/:buildingCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /buildings/byCode/:buildingCode/', metadata)

    const { buildingCode } = ctx.params

    if (!buildingCode || buildingCode.length < 7) {
      ctx.status = 400
      ctx.body = { content: 'Invalid building code', ...metadata }
      return
    }

    const parsedBuildingCode = buildingCode.slice(0, 7)

    try {
      const response = await getBuildingByCode(parsedBuildingCode)
      ctx.body = { 
        content: response, 
        _links: {
          self: {
            href: `/buildings/byCode/${parsedBuildingCode}`
          },
          property: response?.propertyDesignation?.propertyId ? {
            href: `/properties/${response.propertyDesignation.propertyId}`
          } : undefined,
          residences: {
            href: `/residences/?buildingCode=${parsedBuildingCode}`
          }
        },
        ...metadata 
      }
    } catch (error) {
      logger.error('Error fetching building by code:', error)
      ctx.status = 500
      ctx.body = { content: 'Internal server error', ...metadata }
    }
  })

}
