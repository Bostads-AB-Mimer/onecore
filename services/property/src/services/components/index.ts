/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getBuildingParts,
  getBuildings,
  getProperties,
  getPropertyById
} from '../../adapters/property-adapter'
import { getComponentByMaintenanceUnitCode } from '../../adapters/component-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property base service
 *     description: Operations related to property base
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /components/:
   *   get:
   *     summary: Gets a list of components.
   *     description: Returns the component for the relevant unit code.
   *     tags:
   *       - Property base service
   *     parameters:
   *       - in: query
   *         name: maintenanceUnit
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the maintenance unit.
   *     responses:
   *       200:
   *         description: Successfully retrieved the components.
   *         content:
   */
  router.get('(.*)/components/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /components/:maintenanceUnitCode/', metadata)
    const response = await getComponentByMaintenanceUnitCode(ctx.query.maintenanceUnit)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /properties:
   *   get:
   *     summary: Gets all real estate properties
   *     description: Returns the property.
   *     tags:
   *       - Property base service
   *     parameters:
   *       - in: query
   *         name: tract
   *         schema:
   *           type: string
   *         description: Filter properties by tract.
   *     responses:
   *       200:
   *         description: Successfully retrieved the properties.
   *         content:
   */
  router.get('(.*)/properties', async (ctx) => {
    let query = undefined
    if(ctx.query.tract ){
      query = ctx.query.tract.toString()
    }

    const metadata = generateRouteMetadata(ctx);
    logger.info('GET /properties', metadata)
    const response = await getProperties(query)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /buildings/{propertyCode}/:
   *   get:
   *     summary: Gets buildings belonging to a property by property code
   *     description: Returns the buildings belonging to the property.
   *     tags:
   *       - Property base service
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
   */
  router.get('(.*)/buildings/:propertyCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /building/:propertyId/', metadata)
    const response = await getBuildings(ctx.params.propertyCode)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /buildingParts/{buildingCode}/:
   *   get:
   *     summary: Get building parts by building code
   *     description: Returns the building parts.
   *     tags:
   *       - Property base service
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *     responses:
   *       200:
   *         description: Successfully retrieved the building parts.
   *         content:
   */
  router.get('(.*)/buildingParts/:buildingCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /building/:propertyId/', metadata)
    const response = await getBuildingParts(ctx.params.propertyCode)
    ctx.body = { content: response, ...metadata }
  })
}
