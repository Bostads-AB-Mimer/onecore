import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { z } from 'zod'

import {
  getResidenceById,
  getResidencesByBuildingCode,
  getResidencesByBuildingCodeAndStaircaseCode,
} from '../adapters/residence-adapter'
import {
  residencesQueryParamsSchema,
  ResidenceSchema,
  ResidenceDetailedSchema,
} from '../types/residence'
import { parseRequest } from '../middleware/parse-request'

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
   *     summary: Get residences by building code, optionally filtered by staircase code.
   *     description: Returns all residences belonging to a specific building, optionally filtered by staircase code.
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
   *         name: staircaseCode
   *         required: false
   *         schema:
   *           type: string
   *         description: The code of the staircase (optional).
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

  type Residence = z.infer<typeof ResidenceSchema>
  router.get(
    ['(.*)/residences'],
    parseRequest({ query: residencesQueryParamsSchema }),
    async (ctx) => {
      const { buildingCode, staircaseCode } = ctx.request.parsedQuery

      const metadata = generateRouteMetadata(ctx)
      logger.info(
        `GET /residences?buildingCode=${buildingCode}${
          staircaseCode ? `&staircaseCode=${staircaseCode}` : ''
        }`,
        metadata
      )

      try {
        let dbResidences

        if (staircaseCode) {
          dbResidences = await getResidencesByBuildingCodeAndStaircaseCode(
            buildingCode,
            staircaseCode
          )
        } else {
          dbResidences = await getResidencesByBuildingCode(buildingCode)
        }

        const responseContent = dbResidences.map(
          (v): Residence => ({
            code: v.code,
            id: v.id,
            name: v.name || '',
            deleted: Boolean(v.deleted),
            validityPeriod: { fromDate: v.fromDate, toDate: v.toDate },
          })
        )

        ctx.status = 200
        ctx.body = {
          content: ResidenceSchema.array().parse(responseContent),
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'residences route error')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

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
   *                   $ref: '#/components/schemas/ResidenceDetails'
   *       404:
   *         description: Residence not found
   *       500:
   *         description: Internal server error
   */
  type ResidenceDetails = z.infer<typeof ResidenceDetailedSchema>
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

      const rentalId =
        residence.propertyObject?.propertyStructures?.length > 0
          ? residence.propertyObject.propertyStructures[0].rentalId
          : null

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
            energyIndex: residence.propertyObject?.energyIndex?.toNumber(),
          },
          rentalId,
        },
      } satisfies ResidenceDetails)

      ctx.body = {
        content: parsedResidence,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
