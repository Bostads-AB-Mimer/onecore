import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from '@onecore/utilities'

import {
  getFacilitiesByBuildingCode,
  getFacilitiesByPropertyCode,
  getFacilityByRentalId,
  getFacilitySizeByRentalId,
} from '@src/adapters/facility-adapter'
import { GetFacilityByRentalIdResponse } from '@src/types/facility'

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
   * /facilities/rental-id/{rentalId}:
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
  router.get('(.*)/facilities/rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /facilities/rental-id/${ctx.params.rentalId}`, metadata)

    try {
      const facility = await getFacilityByRentalId(ctx.params.rentalId)
      if (!facility) {
        ctx.status = 404
        ctx.body = { reason: 'facility-not-found', ...metadata }
        return
      }

      const areaSize = await getFacilitySizeByRentalId(ctx.params.rentalId)

      const payload: GetFacilityByRentalIdResponse = {
        content: {
          id: facility.propertyObject.facility.id,
          code: facility.propertyObject.facility.code,
          name: facility.propertyObject.facility.name,
          entrance: facility.propertyObject.facility.entrance,
          deleted: Boolean(facility.propertyObject.facility.deleteMark),
          type: {
            code: facility.propertyObject.facility.facilityType.code,
            name: facility.propertyObject.facility.facilityType.name,
          },
          areaSize: areaSize?.value ?? null,
          building: {
            id: facility.buildingId,
            code: facility.buildingCode,
            name: facility.buildingName,
          },
          property: {
            id: facility.propertyId,
            code: facility.propertyCode,
            name: facility.propertyName,
          },
          rentalInformation: {
            rentalId: facility.rentalId,
            apartmentNumber:
              facility.propertyObject.rentalInformation.apartmentNumber,
            type: {
              code: facility.propertyObject.rentalInformation
                .rentalInformationType.code,
              name: facility.propertyObject.rentalInformation
                .rentalInformationType.name,
            },
          },
        },
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
   * /facilities/property-code/{propertyCode}:
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
   *               $ref: '#/components/schemas/GetFacilityByRentalIdResponse'
   *       404:
   *         description: Facility not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/facilities/property-code/:propertyCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /facilities/property-code/${ctx.params.propertyCode}`,
      metadata
    )

    try {
      const facilities = await getFacilitiesByPropertyCode(
        ctx.params.propertyCode
      )
      if (!facilities) {
        ctx.status = 404
        ctx.body = { reason: 'facility-not-found', ...metadata }
        return
      }

      const payload = facilities

      // const payload: GetFacilityByRentalIdResponse = {
      //   content: {
      //     id: facility.propertyObject.facility.id,
      //     code: facility.propertyObject.facility.code,
      //     name: facility.propertyObject.facility.name,
      //     entrance: facility.propertyObject.facility.entrance,
      //     deleted: Boolean(facility.propertyObject.facility.deleteMark),
      //     type: {
      //       code: facility.propertyObject.facility.facilityType.code,
      //       name: facility.propertyObject.facility.facilityType.name,
      //     },
      //     areaSize: areaSize?.value ?? null,
      //     building: {
      //       id: facility.buildingId,
      //       code: facility.buildingCode,
      //       name: facility.buildingName,
      //     },
      //     property: {
      //       id: facility.propertyId,
      //       code: facility.propertyCode,
      //       name: facility.propertyName,
      //     },
      //     rentalInformation: {
      //       rentalId: facility.rentalId,
      //       apartmentNumber:
      //         facility.propertyObject.rentalInformation.apartmentNumber,
      //       type: {
      //         code: facility.propertyObject.rentalInformation
      //           .rentalInformationType.code,
      //         name: facility.propertyObject.rentalInformation
      //           .rentalInformationType.name,
      //       },
      //     },
      //   },
      //   ...metadata,
      // }

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
   * /facilities/building-code/{buildingCode}:
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
   *               $ref: '#/components/schemas/GetFacilityByRentalIdResponse'
   *       404:
   *         description: Facility not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/facilities/building-code/:buildingCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /facilities/building-code/${ctx.params.buildingCode}`,
      metadata
    )

    try {
      const facilities = await getFacilitiesByBuildingCode(
        ctx.params.buildingCode
      )
      if (!facilities) {
        ctx.status = 404
        ctx.body = { reason: 'facility-not-found', ...metadata }
        return
      }

      const payload = facilities

      // const payload: GetFacilityByRentalIdResponse = {
      //   content: {
      //     id: facility.propertyObject.facility.id,
      //     code: facility.propertyObject.facility.code,
      //     name: facility.propertyObject.facility.name,
      //     entrance: facility.propertyObject.facility.entrance,
      //     deleted: Boolean(facility.propertyObject.facility.deleteMark),
      //     type: {
      //       code: facility.propertyObject.facility.facilityType.code,
      //       name: facility.propertyObject.facility.facilityType.name,
      //     },
      //     areaSize: areaSize?.value ?? null,
      //     building: {
      //       id: facility.buildingId,
      //       code: facility.buildingCode,
      //       name: facility.buildingName,
      //     },
      //     property: {
      //       id: facility.propertyId,
      //       code: facility.propertyCode,
      //       name: facility.propertyName,
      //     },
      //     rentalInformation: {
      //       rentalId: facility.rentalId,
      //       apartmentNumber:
      //         facility.propertyObject.rentalInformation.apartmentNumber,
      //       type: {
      //         code: facility.propertyObject.rentalInformation
      //           .rentalInformationType.code,
      //         name: facility.propertyObject.rentalInformation
      //           .rentalInformationType.name,
      //       },
      //     },
      //   },
      //   ...metadata,
      // }

      ctx.status = 200
      ctx.body = payload
    } catch (err) {
      logger.error(err, 'Error fetching facility by rental id')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
