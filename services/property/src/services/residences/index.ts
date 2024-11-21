import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import {
  getResidencesByType,
  getLatestResidences,
  getResidenceById,
} from '../../adapters/residence-adapter'
import { Residence } from '../../types/residence'
import { mapDbToResidence } from './residence-mapper'

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
   * /residences/:
   *   get:
   *     summary: Gets a list of residences.
   *     description: Returns residences filtered by type if a residence type is provided; otherwise, returns the latest residences.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: residenceType
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional filter for the type of residences to retrieve.
   *     responses:
   *       200:
   *         description: Successfully retrieved residences data.
   *         content:
   */

  router.get('(.*)/residences/', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /residences/:residenceTypeId/', metadata)
    let response
    response = await getLatestResidences()
    ctx.body = { content: response, ...metadata }
  })

  /**
   * @swagger
   * components:
   *   schemas:
   *     Residence:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *         code:
   *           type: string
   *         name:
   *           type: string
   *         location:
   *           type: string
   *         accessibility:
   *           type: object
   *           properties:
   *             wheelchairAccessible:
   *               type: boolean
   *             residenceAdapted:
   *               type: boolean
   *             elevator:
   *               type: boolean
   *         features:
   *           type: object
   *           properties:
   *             balcony1:
   *               type: object
   *               properties:
   *                 location:
   *                   type: string
   *                 type:
   *                   type: string
   *             balcony2:
   *               type: object
   *               properties:
   *                 location:
   *                   type: string
   *                 type:
   *                   type: string
   *             patioLocation:
   *               type: string
   *             hygieneFacility:
   *               type: string
   *             sauna:
   *               type: boolean
   *             extraToilet:
   *               type: boolean
   *             sharedKitchen:
   *               type: boolean
   *             petAllergyFree:
   *               type: boolean
   *             electricAllergyIntolerance:
   *               type: boolean
   *             smokeFree:
   *               type: boolean
   *             asbestos:
   *               type: boolean
   *         rooms:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               id:
   *                 type: string
   *               code:
   *                 type: string
   *               name:
   *                 type: string
   *               usage:
   *                 type: object
   *                 properties:
   *                   shared:
   *                     type: boolean
   *                   allowPeriodicWorks:
   *                     type: boolean
   *                 type: boolean
   *               specifications:
   *                 type: object
   *                 properties:
   *                   spaceType:
   *                     type: integer
   *                   hasToilet:
   *                     type: boolean
   *                   isHeated:
   *                     type: integer
   *                   hasThermostatValve:
   *                     type: boolean
   *                   orientation:
   *                     type: integer
   *               dates:
   *                 type: object
   *                 properties:
   *                   installation:
   *                     type: string
   *                     format: date-time
   *                   from:
   *                     type: string
   *                     format: date-time
   *                   to:
   *                     type: string
   *                     format: date-time
   *                   availableFrom:
   *                     type: string
   *                     format: date-time
   *                   availableTo:
   *                     type: string
   *                     format: date-time
   *               deleteMark:
   *                 type: boolean
   *                 type: boolean
   *               fromDate:
   *                 type: string
   *                 format: date-time
   *               toDate:
   *                 type: string
   *                 format: date-time
   *               availableFrom:
   *                 type: string
   *                 format: date-time
   *               availableTo:
   *                 type: string
   *                 format: date-time
   *               timestamp:
   *                 type: string
   *         entrance:
   *           type: string
   *         partNo:
   *           type: integer
   *         part:
   *           type: string
   *         deleted:
   *           type: boolean
   *         validityPeriod:
   *           type: object
   *           properties:
   *             fromDate:
   *               type: string
   *               format: date-time
   *             toDate:
   *               type: string
   *               format: date-time
   *         timestamp:
   *           type: string
   *         residenceType:
   *           type: object
   *           properties:
   *             code:
   *               type: string
   *             name:
   *               type: string
   *             roomCount:
   *               type: integer
   *             kitchen:
   *               type: integer
   *             selectionFundAmount:
   *               type: number
   *         propertyObject:
   *           type: object
   *           properties:
   *             energy:
   *               type: object
   *               properties:
   *                 energyClass:
   *                   type: integer
   *                 energyRegistered:
   *                   type: string
   *                   format: date-time
   *                 energyReceived:
   *                   type: string
   *                   format: date-time
   *                 energyIndex:
   *                   type: number
   *
   * /residences/{id}:
   *   get:
   *     summary: Get a residence by ID.
   *     description: Returns a residence with the specified ID.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence.
   *     responses:
   *       200:
   *         description: Successfully retrieved the residence.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Residence'
   */
  router.get('(.*)/residences/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info(`GET /residences/${ctx.params.id}`, metadata)
    const dbRecord = await getResidenceById(ctx.params.id)
    if (!dbRecord) {
      ctx.status = 404
      return
    }
    console.log('dbRecord', dbRecord)
    const response: Residence = mapDbToResidence(dbRecord)
    ctx.body = { content: response, ...metadata }
  })
}
