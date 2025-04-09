import KoaRouter from '@koa/router'
import { generateRouteMetadata } from 'onecore-utilities'
import { z } from 'zod'

import { registerSchema } from '../../utils/openapi'
import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import * as schemas from './schemas'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Search Service
 *     description: Operations related to searching entities in the system
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */

export const routes = (router: KoaRouter) => {
  registerSchema('SearchQueryParams', schemas.SearchQueryParamsSchema)
  registerSchema('PropertySearchResult', schemas.PropertySearchResultSchema)
  registerSchema('BuildingSearchResult', schemas.BuildingSearchResultSchema)
  registerSchema('SearchResult', schemas.SearchResultSchema)

  /**
   * @swagger
   * /search:
   *   get:
   *     tags:
   *       - Search Service
   *     summary: Omni-search for different entities
   *     description: Search for properties, buildings, and more.
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         type: string
   *         description: The search query string
   *     responses:
   *       200:
   *         description: A list of search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SearchResult'
   *       400:
   *         description: Bad request - invalid query parameters
   *       500:
   *         description: Internal server error.
   */

  type SearchResultResponseContent = z.infer<
    typeof schemas.SearchResultSchema
  >[]

  router.get('(.*)/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = schemas.SearchQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const getProperties = await propertyBaseAdapter.searchProperties(
      queryParams.data.q
    )

    const getBuildings = await propertyBaseAdapter.searchBuildings(
      queryParams.data.q
    )

    if (!getProperties.ok || !getBuildings.ok) {
      ctx.status = 500
      return
    }

    const mappedProperties = getProperties.data.map(
      (property): schemas.PropertySearchResult => ({
        id: property.id,
        type: 'property',
        name: property.designation,
      })
    )

    const mappedBuildings = getBuildings.data.map(
      (building): schemas.BuildingSearchResult => ({
        id: building.id,
        type: 'building',
        name: building.name,
      })
    )

    ctx.body = {
      ...metadata,
      content: [
        ...mappedProperties,
        ...mappedBuildings,
      ] satisfies SearchResultResponseContent,
    }
  })
}
