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
   *     summary: Get detailed information about a specific property
   *     description: |
   *       Retrieves comprehensive information about a real estate property using its unique identifier.
   *       Returns detailed property information including property code, tract, designation,
   *       and associated property objects.
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
   *               oneOf:
   *                 - $ref: '#/components/schemas/PropertyList'
   *                 - $ref: '#/components/schemas/Property'
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
   *     summary: Get a list of all real estate properties
   *     description: |
   *       Retrieves a list of all real estate properties in the system.
   *       Can be filtered by tract if provided. Returns basic property information
   *       including property ID, code, tract, and designation.
   *     tags:
   *       - Properties
   *     parameters:
   *       - in: query
   *         name: tract
   *         schema:
   *           type: string
   *         description: Optional filter to get properties in a specific tract
   *         example: "T123"
   *     responses:
   *       200:
   *         description: Successfully retrieved list of properties
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PropertyList'
   *       500:
   *         description: Internal server error
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
