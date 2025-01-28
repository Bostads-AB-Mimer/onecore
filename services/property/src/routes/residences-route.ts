import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getResidenceById,
  getResidencesByBuildingCode,
  getResidencesByBuildingCodeAndFloorCode,
} from '../adapters/residence-adapter'
import {
  residencesQueryParamsSchema,
  ResidenceSchema,
  ResidenceDetailedSchema,
} from '../types/residence'
import { ResidenceLinksSchema, ResidenceListLinksSchema } from '../types/links'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Residences
 *     description: Operations related to residences
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /residences:
   *   get:
   *     summary: Get residences by building code, optionally filtered by floor code.
   *     description: Returns all residences belonging to a specific building, optionally filtered by floor code.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *       - in: query
   *         name: floorCode
   *         required: false
   *         schema:
   *           type: string
   *         description: The floor code of the staircase (optional).
   *     responses:
   *       200:
   *         description: Successfully retrieved the residences.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Residence'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(['(.*)/residences'], async (ctx) => {
    const queryParams = residencesQueryParamsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { buildingCode, floorCode } = queryParams.data

    const metadata = generateRouteMetadata(ctx)
    logger.info(
      `GET /residences?buildingCode=${buildingCode}${
        floorCode ? `&floorCode=${floorCode}` : ''
      }`,
      metadata
    )

    try {
      let dbResidences

      if (floorCode) {
        dbResidences = await getResidencesByBuildingCodeAndFloorCode(
          buildingCode,
          floorCode
        )
      } else {
        dbResidences = await getResidencesByBuildingCode(buildingCode)
      }

      const responseContent = dbResidences.map((residence) => {
        const links = ResidenceListLinksSchema.parse({
          self: { href: `/residences/${residence.id}` },
          components: { href: `/components?residenceCode=${residence.code}` },
        })

        const parsedResidence = ResidenceSchema.parse({
          id: residence.id,
          code: residence.code,
          name: residence.name || '',
          deleted: Boolean(residence.deleted),
          buildingCode: buildingCode,
          validityPeriod: {
            fromDate: residence.fromDate,
            toDate: residence.toDate,
          },
        })
        return {
          ...parsedResidence,
          _links: links,
        }
      })

      ctx.body = {
        content: responseContent,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /residences/{id}:
   *   get:
   *     summary: Get a residence by ID
   *     description: Returns a residence with the specified ID
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence
   *     responses:
   *       200:
   *         description: Successfully retrieved the residence
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   allOf:
   *                     - $ref: '#/components/schemas/ResidenceDetails'
   *                     - type: object
   *                       properties:
   *                         _links:
   *                           $ref: '#/components/schemas/ResidenceLinks'
   *       404:
   *         description: Residence not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/residences/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /residences/${id}`, metadata)

    try {
      const residence = await getResidenceById(id)
      if (!residence) {
        ctx.status = 404
        return
      }

      // TODO: find out why building is null in residence
      //const building = await getBuildingByCode(residence.buildingCode)

      console.log('residence', residence)

      const parsedResidence = ResidenceDetailedSchema.parse({
        id: residence.id,
        code: residence.code,
        name: residence.name || '',
        location: residence.location || '',
        accessibility: {
          wheelchairAccessible: Boolean(residence.wheelchairAccessible),
          residenceAdapted: Boolean(residence.residenceAdapted),
          elevator: Boolean(residence.elevator),
        },
        features: {
          balcony1: residence.balcony1Location
            ? {
                location: residence.balcony1Location,
                type: residence.balcony1Type || '',
              }
            : undefined,
          balcony2: residence.balcony2Location
            ? {
                location: residence.balcony2Location,
                type: residence.balcony2Type || '',
              }
            : undefined,
          patioLocation: residence.patioLocation || undefined,
          hygieneFacility: residence.hygieneFacility || '',
          sauna: Boolean(residence.sauna),
          extraToilet: Boolean(residence.extraToilet),
          sharedKitchen: Boolean(residence.sharedKitchen),
          petAllergyFree: Boolean(residence.petAllergyFree),
          electricAllergyIntolerance: Boolean(
            residence.electricAllergyIntolerance
          ),
          smokeFree: Boolean(residence.smokeFree),
          asbestos: Boolean(residence.asbestos),
        },
        entrance: residence.entrance || '',
        partNo: residence.partNo,
        part: residence.part,
        deleted: Boolean(residence.deleted),
        validityPeriod: {
          fromDate: residence.fromDate,
          toDate: residence.toDate,
        },
        residenceType: {
          residenceTypeId: residence.residenceType?.id || '',
          code: residence.residenceType?.code || '',
          name: residence.residenceType?.name,
          roomCount: residence.residenceType?.roomCount,
          kitchen: residence.residenceType?.kitchen || 0,
          systemStandard: residence.residenceType?.systemStandard || 0,
          checklistId: residence.residenceType?.checklistId,
          componentTypeActionId: residence.residenceType?.componentTypeActionId,
          statisticsGroupSCBId: residence.residenceType?.statisticsGroupSCBId,
          statisticsGroup2Id: residence.residenceType?.statisticsGroup2Id,
          statisticsGroup3Id: residence.residenceType?.statisticsGroup3Id,
          statisticsGroup4Id: residence.residenceType?.statisticsGroup4Id,
          timestamp:
            residence.residenceType?.timestamp || new Date().toISOString(),
        },
        propertyObject: {
          energy: {
            energyClass: residence.propertyObject?.energyClass || 0,
            energyRegistered:
              residence.propertyObject?.energyRegistered || undefined,
            energyReceived:
              residence.propertyObject?.energyReceived || undefined,
            energyIndex: residence.propertyObject?.energyIndex || undefined,
          },
        },
      })

      const _links = ResidenceLinksSchema.parse({
        self: { href: `/residences/${residence.id}` },
        building: {
          href: `/buildings/${residence.propertyObject.building?.buildingCode}`, // TODO: check why building is null here sometimes
        },
        property: {
          href: `/properties/${residence.propertyObject.property?.id}`,
        },
        rooms: {
          href: `/rooms?buildingCode=${residence.propertyObject.building?.buildingCode}&residenceCode=${residence.code}`,
        },
        components: { href: `/components?residenceCode=${residence.code}` },
        parent: {
          href: `/buildings/${residence.propertyObject.building?.buildingCode}`,
        },
      })

      ctx.body = {
        content: {
          ...parsedResidence,
          _links,
        },
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
