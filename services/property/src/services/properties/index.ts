/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getProperties, getPropertyById } from '../../adapters/property-adapter'
import { generateMetaLinks } from '../../utils/links'
import { propertiesQueryParamsSchema } from '../../types/property'

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

      ctx.body = {
        content: properties.map((property) => ({
          ...property,
          _links: {
            self: {
              href: `/properties/Id/${property.id}`,
            },
          },
        })),
        ...metadata,
        _links: generateMetaLinks(ctx, '/properties'),
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
   *                   $ref: '#/components/schemas/PropertyDetails'
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

      ctx.body = {
        content: property,
        ...metadata,
        _links: generateMetaLinks(ctx, '/properties', {
          id: ctx.params.id,
          buildings: property?.code || '',
        }),
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
