/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getProperties,
  getPropertyById
} from '../../adapters/property-adapter'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Properties
 *     description: Operations related to properties
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /properties/{id}/:
   *   get:
   *     summary: Get a real estate property by ID
   *     description: Returns the property.
   *     tags:
   *       - Properties
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the rental property.
   *     responses:
   *       200:
   *         description: Successfully retrieved the property.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PropertyList'
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Property'
   */
  router.get('(.*)/properties/:id/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /properties/:id/', metadata)
    const response = await getPropertyById(ctx.params.id)
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * /properties/:
   *   get:
   *     summary: Gets all real estate properties
   *     description: Returns the property.
   *     tags:
   *       - Properties
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
  router.get('(.*)/properties/', async (ctx) => {
    let query = undefined
    if(ctx.query.tract ){
      query = ctx.query.tract.toString()
    }

    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /properties', metadata)
    const response = await getProperties(query)
    ctx.body = { content: response, ...metadata }
  })
}
