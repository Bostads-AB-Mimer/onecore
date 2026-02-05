import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
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
  registerSchema('ResidenceSearchResult', schemas.ResidenceSearchResultSchema)
  registerSchema(
    'ParkingSpaceSearchResult',
    schemas.ParkingSpaceSearchResultSchema
  )
  registerSchema(
    'MaintenanceUnitSearchResult',
    schemas.MaintenanceUnitSearchResultSchema
  )
  registerSchema('SearchResult', schemas.SearchResultSchema)

  /**
   * @swagger
   * /search:
   *   get:
   *     tags:
   *       - Search Service
   *     summary: Omni-search for different entities
   *     description: |
   *       Search for properties, buildings, residences, parking spaces, and maintenance units.
   *       - Properties: Matches on property name
   *       - Buildings: Matches on building name
   *       - Residences: Matches on rental ID or residence name
   *       - Parking Spaces: Matches on rental ID or parking space name
   *       - Maintenance Units: Matches on code
   *       Returns up to 10 results per entity type (max 50 total results).
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

    const getResidences = await propertyBaseAdapter.searchResidences(
      queryParams.data.q
    )

    const getParkingSpaces = await propertyBaseAdapter.searchParkingSpaces(
      queryParams.data.q
    )

    const getMaintenanceUnits =
      await propertyBaseAdapter.searchMaintenanceUnits(queryParams.data.q)

    if (
      !getProperties.ok ||
      !getBuildings.ok ||
      !getResidences.ok ||
      !getParkingSpaces.ok ||
      !getMaintenanceUnits.ok
    ) {
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
        property: building.property,
      })
    )

    const mappedResidences = getResidences.data.map(
      (residence): schemas.ResidenceSearchResult => ({
        id: residence.id,
        type: 'residence',
        name: residence.name,
        rentalId: residence.rentalId,
        property: residence.property,
        building: residence.building,
      })
    )

    const mappedParkingSpaces = getParkingSpaces.data.map(
      (parkingSpace): schemas.ParkingSpaceSearchResult => ({
        id: parkingSpace.id,
        type: 'parking-space',
        name: parkingSpace.name,
        rentalId: parkingSpace.rentalId,
        code: parkingSpace.code,
        property: parkingSpace.property,
        building: parkingSpace.building,
      })
    )

    const mappedMaintenanceUnits = getMaintenanceUnits.data.map(
      (unit): schemas.MaintenanceUnitSearchResult => ({
        id: unit.id,
        type: 'maintenance-unit',
        code: unit.code,
        caption: unit.caption,
        maintenanceType: unit.type,
        estateCode: unit.estateCode,
        estate: unit.estate,
      })
    )

    ctx.body = {
      ...metadata,
      content: [
        ...mappedProperties,
        ...mappedBuildings,
        ...mappedResidences,
        ...mappedParkingSpaces,
        ...mappedMaintenanceUnits,
      ] satisfies SearchResultResponseContent,
    }
  })
}
