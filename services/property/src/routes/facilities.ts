import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from '@onecore/utilities'

import {
  getFacilitiesByBuildingCode,
  getFacilitiesByPropertyCode,
  getFacilityByRentalId,
  searchFacilities,
} from '@src/adapters/facility-adapter'
import {
  GetFacilityByRentalIdResponse,
  GetFacilitiesByPropertyCodeResponse,
  GetFacilitiesByBuildingCodeResponse,
  FacilitySearchResult,
} from '@src/types/facility'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Facilities
 *     description: Operations related to facilities
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /facilities/search:
   *   get:
   *     summary: Search facilities
   *     description: |
   *       Searches for facilities by rental id.
   *     tags:
   *       - Facilities
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: The search query (rental id).
   *     responses:
   *       200:
   *         description: |
   *           Successfully retrieved facilities matching the search query.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/FacilitySearchResult'
   *       400:
   *         description: Invalid query provided
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/facilities/search', async (ctx) => {
    const q = ctx.query.q as string
    const metadata = generateRouteMetadata(ctx)

    if (!q) {
      ctx.status = 400
      ctx.body = {
        reason: 'Query parameter "q" is required',
        ...metadata,
      }
      return
    }

    try {
      const facilities = await searchFacilities(q)

      ctx.status = 200
      ctx.body = {
        content: facilities.map(
          (f): FacilitySearchResult => ({
            id: f.id,
            rentalId: f.rentalId,
            code: f.code,
            name: f.name,
            property: f.property,
            building: f.building,
          })
        ),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err }, 'Error searching facilities')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /facilities/by-rental-id/{rentalId}:
   *   get:
   *     summary: Get a facility by rental ID
   *     description: Returns a facility with the specified rental ID
   *     tags:
   *       - Facilities
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental ID of the facility
   *     responses:
   *       200:
   *         description: Successfully retrieved the facility
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GetFacilityByRentalIdResponse'
   *       404:
   *         description: Facility not found
   *       500:
   *         description: Internal server error
   */
  router.get('/facilities/by-rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(metadata, `GET /facilities/by-rental-id/${ctx.params.rentalId}`)

    try {
      const facility = await getFacilityByRentalId(ctx.params.rentalId)
      if (!facility) {
        ctx.status = 404
        ctx.body = { reason: 'facility-not-found', ...metadata }
        return
      }

      const payload: GetFacilityByRentalIdResponse = {
        content: facility,
        ...metadata,
      }

      ctx.status = 200
      ctx.body = payload
    } catch (err) {
      logger.error(err, 'Error fetching facility by rental id')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /facilities/by-property-code/{propertyCode}:
   *   get:
   *     summary: Get facilities by property code
   *     description: Returns a list of facilities for the specified property code
   *     tags:
   *       - Facilities
   *     parameters:
   *       - in: path
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The property code of the property
   *     responses:
   *       200:
   *         description: Successfully retrieved the facilities
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GetFacilitiesByPropertyCodeResponse'
   *       404:
   *         description: Facilities not found
   *       500:
   *         description: Internal server error
   */
  router.get('/facilities/by-property-code/:propertyCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(
      metadata,
      `GET /facilities/property-code/${ctx.params.propertyCode}`
    )

    try {
      const facilities = await getFacilitiesByPropertyCode(
        ctx.params.propertyCode
      )
      if (!facilities || facilities.length === 0) {
        ctx.status = 404
        ctx.body = { reason: 'facilities-not-found', ...metadata }
        return
      }

      const payload: GetFacilitiesByPropertyCodeResponse = {
        content: facilities,
        ...metadata,
      }

      ctx.status = 200
      ctx.body = payload
    } catch (err) {
      logger.error(err, 'Error fetching facilities by property code')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /facilities/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get facilities by building code
   *     description: Returns a list of facilities for the specified building code
   *     tags:
   *       - Facilities
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building
   *     responses:
   *       200:
   *         description: Successfully retrieved the facilities
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GetFacilitiesByBuildingCodeResponse'
   *       404:
   *         description: Facilities not found
   *       500:
   *         description: Internal server error
   */
  router.get('/facilities/by-building-code/:buildingCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(
      metadata,
      `GET /facilities/building-code/${ctx.params.buildingCode}`
    )

    try {
      console.log(
        'Fetching facilities by building code:',
        ctx.params.buildingCode
      )
      const facilities = await getFacilitiesByBuildingCode(
        ctx.params.buildingCode
      )
      if (!facilities || facilities.length === 0) {
        ctx.status = 404
        ctx.body = { reason: 'facilities-not-found', ...metadata }
        return
      }

      const payload: GetFacilitiesByBuildingCodeResponse = {
        content: facilities,
        ...metadata,
      }

      ctx.status = 200
      ctx.body = payload
    } catch (err) {
      logger.error(err, 'Error fetching facilities by building code')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
