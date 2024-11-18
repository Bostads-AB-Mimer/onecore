/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getBuilding,
  getBuildings,
} from '../../adapters/building-adapter'
import {getPropertyById} from "../../adapters/property-adapter";

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
   *     summary: Gets buildings belonging to a property by property code
   *     description: Returns the buildings belonging to the property.
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
   */
  router.get('(.*)/buildings/:propertyCode/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /buildings/:propertyId/', metadata)
    const response = await getBuildings(ctx.params.propertyCode)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /buildings/byId/{id}/:
   *   get:
   *     summary: Get a building by ID
   *     description: Returns the building.
   *     tags:
   *       - Buildings
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the building.
   *     responses:
   *       200:
   *         description: Successfully retrieved the building.
   *         content:
   */
  //todo: better slug for this route
  router.get('(.*)/buildings/byId/:id/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /buildings/:id/', metadata)
    const response = await getBuilding(ctx.params.id)
    ctx.body = { content: response, ...metadata }
  })
}
