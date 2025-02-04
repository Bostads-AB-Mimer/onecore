/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { etagMiddleware } from '../middleware/etag'
import { getProperties, getPropertyById } from '../adapters/property-adapter'
import { generateMetaLinks } from '../utils/links'
import {
  propertiesQueryParamsSchema,
  PropertySchema,
  PropertyDetailsSchema,
} from '../types/property'
import { PropertyLinksSchema } from '../types/links'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Properties
 *     description: Operations related to properties
 */
export const routes = (router: KoaRouter) => {
  router.use(etagMiddleware())
  /**
   * @swagger
   * /properties:
   *   get:
   *     summary: Get a list of all properties belonging to a company
   *     description: |
   *       Retrieves a list of all real estate properties belonging to a specific company.
   *       Can be filtered by tract if provided. Returns basic property information
   *       including property ID, code, tract, and designation.
   *     tags:
   *       - Properties
   *     parameters:
   *       - in: query
   *         name: companyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the company that owns the properties.
   *       - in: query
   *         name: tract
   *         schema:
   *           type: string
   *         description: Optional filter to get properties in a specific tract.
   *     responses:
   *       200:
   *         description: Successfully retrieved list of properties.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Property'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/properties', async (ctx) => {
    const queryParams = propertiesQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { companyCode, tract } = queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /properties?companyCode=${companyCode}&tract=${tract}`,
      metadata
    )

    try {
      const properties = await getProperties(companyCode, tract)

      const responseContent = properties.map((property) => {
        return {
          ...property,
          _links: PropertyLinksSchema.parse({
            self: { href: `/properties/${property.propertyId}` },
            buildings: { href: `/buildings?propertyCode=${property.code}` },
          }),
        }
      })

      ctx.body = {
        content: responseContent,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /properties/{id}:
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
   *         description: The ID of the property.
   *     responses:
   *       200:
   *         description: Successfully retrieved the property.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   allOf:
   *                     - $ref: '#/components/schemas/PropertyDetails'
   *                     - type: object
   *                       properties:
   *                         _links:
   *                           $ref: '#/components/schemas/PropertyLinks'
   *       404:
   *         description: Property not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/properties/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /properties/${id}`, metadata)

    try {
      const property = await getPropertyById(id)

      if (!property) {
        ctx.status = 404
        return
      }

      const parsedPropertyDetails = PropertyDetailsSchema.parse({
        ...property,
        _links: PropertyLinksSchema.parse({
          self: { href: `/properties/${property.propertyObjectId}` },
          buildings: { href: `/buildings?propertyCode=${property.code}` },
        }),
      })

      ctx.body = {
        content: parsedPropertyDetails,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
