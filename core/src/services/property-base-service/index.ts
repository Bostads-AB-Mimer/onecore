import KoaRouter from '@koa/router'
import { z } from 'zod'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'

import { logger, generateRouteMetadata } from '@onecore/utilities'
import { registerSchema } from '../../utils/openapi'
import * as schemas from './schemas'
import { calculateResidenceStatus } from './calculate-residence-status'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property base Service
 *     description: Operations related to property base
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
  registerSchema('Building', schemas.BuildingSchema)
  registerSchema('Company', schemas.CompanySchema)
  registerSchema('Property', schemas.PropertySchema)
  registerSchema('Residence', schemas.ResidenceSchema)
  registerSchema('ResidenceDetails', schemas.ResidenceDetailsSchema)
  registerSchema('ResidenceSummary', schemas.ResidenceSummarySchema)
  registerSchema('Staircase', schemas.StaircaseSchema)
  registerSchema('Room', schemas.RoomSchema)
  registerSchema('ParkingSpace', schemas.ParkingSpaceSchema)
  registerSchema('MaintenanceUnit', schemas.MaintenanceUnitSchema)
  registerSchema(
    'ResidenceByRentalIdDetails',
    schemas.ResidenceByRentalIdSchema
  )
  registerSchema('FacilityDetails', schemas.FacilityDetailsSchema)

  /**
   * @swagger
   * /buildings:
   *   get:
   *     summary: Get all buildings for a specific property
   *     tags:
   *       - Property base Service
   *     description: |
   *       Retrieves all buildings associated with a given property code.
   *       Returns detailed information about each building including its code, name,
   *       construction details, and associated property information.
   *     parameters:
   *       - in: query
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the property.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the buildings.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Building'
   *       '400':
   *         description: Invalid query parameters.
   *       '500':
   *         description: Internal server error.
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/buildings', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.GetBuildingsQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors }
      return
    }
    const { propertyCode } = params.data

    try {
      const result = await propertyBaseAdapter.getBuildings(propertyCode)

      if (!result.ok) {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Building[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /buildings/{id}:
   *   get:
   *     summary: Get detailed information about a specific building
   *     tags:
   *       - Property base Service
   *     description: |
   *       Retrieves comprehensive information about a building using its unique building id.
   *       Returns details including construction year, renovation history, insurance information,
   *       and associated property data.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique id of the building
   *     responses:
   *       '200':
   *         description: Successfully retrieved building information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Building'
   *       '404':
   *         description: Building not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Building not found
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/buildings/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { id } = ctx.params

    try {
      const result = await propertyBaseAdapter.getBuildingById(id)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Building not found', ...metadata }
          return
        }

        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Building,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /buildings/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get building by building code
   *     tags:
   *       - Property base Service
   *     description: Retrieves building data by building code
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the building
   *     responses:
   *       '200':
   *         description: Successfully retrieved building
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Building'
   *       '404':
   *         description: Building not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Building not found
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/buildings/by-building-code/:buildingCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { buildingCode } = ctx.params

    try {
      const result = await propertyBaseAdapter.getBuildingByCode(buildingCode)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Building not found', ...metadata }
          return
        }

        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Building,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /buildings/by-property-code/{propertyCode}:
   *   get:
   *     summary: Get buildings by property code
   *     tags:
   *       - Property base Service
   *     description: Retrieves buildings by property code
   *     parameters:
   *       - in: path
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the property to fetch buildings for
   *     responses:
   *       '200':
   *         description: Successfully retrieved buildings
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Building'
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/buildings/by-property-code/:propertyCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { propertyCode } = ctx.params

    try {
      const result =
        await propertyBaseAdapter.getBuildingsByPropertyCode(propertyCode)
      if (!result.ok) {
        logger.error(result.err, 'Internal server error', metadata)
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Building[],
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Internal server error', metadata)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /propertyBase/companies:
   *   get:
   *     summary: Get all companies
   *     tags:
   *       - Property base Service
   *     description: Retrieves companies from property base
   *     responses:
   *       200:
   *         description: Successfully retrieved companies
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Company'
   *       500:
   *          description: Internal server error
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  error:
   *                    type: string
   *                    example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/companies', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const response = await propertyBaseAdapter.getCompanies()

      if (!response.ok) {
        logger.error(
          {
            err: response.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: response.data satisfies schemas.Company[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /residences:
   *   get:
   *     summary: Get residences by building code and (optional) staircase code
   *     tags:
   *       - Property base Service
   *     description: Retrieves residences by building code and (optional) staircase code
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Code for the building to fetch residences from
   *       - in: query
   *         name: staircaseCode
   *         required: false
   *         schema:
   *           type: string
   *         description: Code for the staircase to fetch residences from
   *     responses:
   *       '200':
   *         description: Successfully retrieved residences
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Residence'
   *       '400':
   *         description: Missing building code or invalid query parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                   error:
   *                     type: object
   *       '500':
   *          description: Internal server error
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  error:
   *                    type: string
   *                    example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/residences', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.GetResidencesQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors }
      return
    }
    const { buildingCode, staircaseCode } = params.data

    try {
      const result = await propertyBaseAdapter.getResidences(
        buildingCode,
        staircaseCode
      )
      if (!result.ok) {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Residence[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /properties:
   *   get:
   *     summary: Get properties by company code and (optional) tract
   *     tags:
   *       - Property base Service
   *     description: Retrieves properties by company code and (optional) tract
   *     parameters:
   *       - in: query
   *         name: companyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the company that owns the properties.
   *       - in: query
   *         name: tract
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional filter to get properties in a specific tract.
   *     responses:
   *       '200':
   *         description: Successfully retrieved properties
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Property'
   *       '400':
   *         description: Missing company code or invalid query parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: object
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/properties', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.GetPropertiesQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors }
      return
    }
    const { companyCode, tract } = params.data

    try {
      const result = await propertyBaseAdapter.getProperties(companyCode, tract)

      if (!result.ok) {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Property[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /properties/search:
   *   get:
   *     summary: Search properties
   *     description: |
   *       Retrieves a list of all real estate properties by name.
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: The search query.
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/properties/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = z.object({ q: z.string() }).safeParse(ctx.query)

    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors }
      return
    }

    const { q } = params.data

    try {
      const result = await propertyBaseAdapter.searchProperties(q)

      if (!result.ok) {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Property[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /properties/{propertyId}:
   *   get:
   *     summary: Get property by property id
   *     tags:
   *       - Property base Service
   *     description: Retrieves property by property id
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The id of the property
   *     responses:
   *       '200':
   *         description: Successfully retrieved property
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Property'
   *       '404':
   *         description: Property not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Property not found
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/properties/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { propertyId } = ctx.params

    try {
      const result = await propertyBaseAdapter.getPropertyDetails(propertyId)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Property not found', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.PropertyDetails,
        ...metadata,
      }
    } catch (error) {
      logger.error({ metadata, error }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /residences/by-rental-id/{rentalId}:
   *   get:
   *     summary: Get residence data by residence rental id
   *     tags:
   *       - Property base Service
   *     description: Retrieves residence data by residence rental id
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental id for the residence to fetch
   *     responses:
   *       '200':
   *         description: Successfully retrieved residence.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ResidenceByRentalIdDetails'
   *       '404':
   *         description: Residence not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Residence not found
   *       '500':
   *         description: Internal server error. Failed to retrieve residence data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/residences/by-rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalId } = ctx.params

    const getResidence =
      await propertyBaseAdapter.getResidenceByRentalId(rentalId)

    if (!getResidence.ok) {
      if (getResidence.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'Residence not found', ...metadata }
        return
      }

      logger.error({ err: getResidence.err, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: getResidence.data satisfies schemas.ResidenceByRentalIdDetails,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /residences/{residenceId}:
   *   get:
   *     summary: Get residence data by residenceId
   *     tags:
   *       - Property base Service
   *     description: Retrieves residence data by residenceId
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Id for the residence to fetch
   *     responses:
   *       '200':
   *         description: Successfully retrieved residence.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ResidenceDetails'
   *       '404':
   *         description: Residence not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Residence not found
   *       '500':
   *         description: Internal server error. Failed to retrieve residence data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/residences/:residenceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { residenceId } = ctx.params

    try {
      const getResidence =
        await propertyBaseAdapter.getResidenceDetails(residenceId)

      if (!getResidence.ok) {
        if (getResidence.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Residence not found', ...metadata }
          return
        }

        logger.error(
          { err: getResidence.err, metadata },
          'Internal server error'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      if (!getResidence.data.propertyObject.rentalId) {
        ctx.status = 200
        ctx.body = {
          content: schemas.ResidenceDetailsSchema.parse({
            ...getResidence.data,
            status: null,
          }),
          ...metadata,
        }
        return
      }

      const leases = await leasingAdapter.getLeasesForPropertyId(
        getResidence.data.propertyObject.rentalId,
        {
          includeContacts: false,
          includeTerminatedLeases: false,
          includeUpcomingLeases: true,
        }
      )

      const status = calculateResidenceStatus(leases)

      ctx.status = 200
      ctx.body = {
        content: schemas.ResidenceDetailsSchema.parse({
          ...getResidence.data,
          status,
        }),
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /residences/summary/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get residences by building code, optionally filtered by staircase code.
   *     description: Returns all residences belonging to a specific building, optionally filtered by staircase code.
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
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
   *                     $ref: '#/components/schemas/ResidenceSummary'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '(.*)/residences/summary/by-building-code/:buildingCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { buildingCode } = ctx.params
      const params = schemas.ResidenceSummaryQueryParamsSchema.safeParse(
        ctx.query
      )

      if (!params.success) {
        ctx.status = 400
        ctx.body = { error: params.error.errors, ...metadata }
        return
      }

      const { staircaseCode } = params.data

      try {
        const result =
          await propertyBaseAdapter.getResidenceSummariesByBuildingCode(
            buildingCode,
            staircaseCode
          )

        if (!result.ok) {
          logger.error(
            { err: result.err, metadata },
            'Error getting residence summaries from property-base'
          )
          ctx.status = 500
          ctx.body = { error: 'Internal server error', ...metadata }
          return
        }

        ctx.body = {
          content: result.data satisfies schemas.ResidenceSummary[],
          ...metadata,
        }
      } catch (error) {
        logger.error({ error, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /staircases:
   *   get:
   *     summary: Get staircases for a building
   *     tags:
   *       - Property base Service
   *     description: Retrieves staircases for a building
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Code for the building to fetch staircases for
   *     responses:
   *       '200':
   *         description: Successfully retrieved staircases.
   *         content:
   *           application/json:
   *             schema:
   *              type: object
   *              properties:
   *                content:
   *                  type: array
   *                  items:
   *                    $ref: '#/components/schemas/Staircase'
   *       '400':
   *         description: Missing buildingCode
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Missing buildingCode
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/staircases', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = schemas.StaircasesQueryParamsSchema.safeParse(ctx.query)
    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }
    const { buildingCode } = queryParams.data

    try {
      const result = await propertyBaseAdapter.getStaircases(buildingCode)
      if (!result.ok) {
        logger.error({ metadata, err: result.err }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Staircase[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')

      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /rooms:
   *   get:
   *     summary: Get rooms by residence id.
   *     description: Returns all rooms belonging to a residence.
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The id of the residence.
   *     responses:
   *       200:
   *         description: Successfully retrieved the rooms.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Room'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/rooms', async (ctx) => {
    const queryParams = schemas.GetRoomsQueryParamsSchema.safeParse(ctx.query)
    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { errors: queryParams.error.errors }
      return
    }

    const { residenceId } = queryParams.data

    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await propertyBaseAdapter.getRooms(residenceId)
      if (!result.ok) {
        logger.error(
          { err: result.err, metadata },
          'Error getting rooms from property-base'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies Array<schemas.Room>,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /parking-spaces/by-rental-id/{rentalId}:
   *   get:
   *     summary: Get parking space data by rentalId
   *     tags:
   *       - Property base Service
   *     description: Retrieves parking space data by rentalId
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental id to fetch parking space for
   *     responses:
   *       '200':
   *         description: Successfully retrieved parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ParkingSpace'
   *       '404':
   *         description: Parking space not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Parking space not found
   *       '500':
   *         description: Internal server error. Failed to retrieve parking space data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/parking-spaces/by-rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalId } = ctx.params

    try {
      const response =
        await propertyBaseAdapter.getParkingSpaceByRentalId(rentalId)

      if (!response.ok) {
        if (response.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Parking space not found', ...metadata }
          return
        }

        logger.error({ metadata, err: response.err }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
      ctx.status = 200

      ctx.body = {
        content: schemas.ParkingSpaceSchema.parse(response.data),
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /maintenance-units/by-rental-id/{rentalId}:
   *   get:
   *     summary: Get maintenance units by rental id.
   *     description: Returns all maintenance units belonging to a rental property.
   *     tags:
   *       - Property base Service
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the rental property for which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/maintenance-units/by-rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalId } = ctx.params

    try {
      const result =
        await propertyBaseAdapter.getMaintenanceUnitsForRentalProperty(rentalId)
      if (!result.ok) {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting maintenance units from property-base'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies Array<schemas.MaintenanceUnit>,
        ...metadata,
      }
    } catch (error) {
      logger.error({ metadata, error }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /maintenance-units/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get maintenance units by building code.
   *     description: Returns all maintenance units belonging to a building.
   *     tags:
   *       - Property base Service
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the building for which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(
    '(.*)/maintenance-units/by-building-code/:buildingCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { buildingCode } = ctx.params

      logger.info(
        metadata,
        `GET /maintenance-units/by-building-code/${buildingCode}`
      )

      try {
        const result =
          await propertyBaseAdapter.getMaintenanceUnitsByBuildingCode(
            buildingCode
          )

        if (!result.ok) {
          if (result.err === 'not-found') {
            ctx.status = 404
            ctx.body = { error: 'No maintenance units found', ...metadata }
            return
          }

          logger.error(
            { err: result.err, metadata },
            'Error getting maintenance units from property-base'
          )
          ctx.status = 500
          ctx.body = { error: 'Internal server error', ...metadata }
          return
        }

        if (result.data.length === 0) {
          ctx.status = 404
          ctx.body = { error: 'No maintenance units found', ...metadata }
          return
        }

        ctx.body = {
          content: result.data satisfies Array<schemas.MaintenanceUnit>,
          ...metadata,
        }
      } catch (error) {
        logger.error({ error, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /maintenance-units/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get maintenance units by contact code.
   *     description: Returns all maintenance units belonging to a contact code.
   *     tags:
   *       - Property base Service
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code for which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       ok:
   *                         type: boolean
   *                       data:
   *                         type: array
   *                         items:
   *                           $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get(
    '(.*)/maintenance-units/by-contact-code/:contactCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const leases = await leasingAdapter.getLeasesForContactCode(
          ctx.params.contactCode,
          {
            includeUpcomingLeases: true,
            includeTerminatedLeases: false,
            includeContacts: false,
          }
        )
        const promises = leases
          .filter(
            (lease) =>
              lease.type.toLocaleLowerCase().trimEnd() === 'bostadskontrakt'
          )
          .map((lease) =>
            propertyBaseAdapter.getMaintenanceUnitsForRentalProperty(
              lease.rentalPropertyId
            )
          )

        const maintenanceUnits = await Promise.all(promises).then((units) =>
          units.filter((unit) => unit !== undefined).flat()
        )

        if (maintenanceUnits && maintenanceUnits.length > 0) {
          ctx.status = 200
          ctx.body = { content: maintenanceUnits, ...metadata }
        } else {
          ctx.status = 200
          ctx.body = {
            content: [],
            reason: 'No maintenance units found',
            ...metadata,
          }
          logger.info('No maintenance units found')
          return
        }
      } catch (error) {
        console.error('Error:', error)
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }
  )

  /**
   * @swagger
   * /facilities/by-rental-id/{rentalId}:
   *   get:
   *     summary: Get facility by rental id.
   *     description: Returns facility.
   *     tags:
   *       - Property base Service
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental id of the facility.
   *     responses:
   *       200:
   *         description: Successfully retrieved the facility.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/FacilityDetails'
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/facilities/by-rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalId } = ctx.params

    logger.info(metadata, `GET /facilities/by-rental-id/${rentalId}`)

    try {
      const result = await propertyBaseAdapter.getFacilityByRentalId(rentalId)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Facility not found', ...metadata }
          return
        }

        logger.error(
          { err: result.err },
          'Error getting facility from property-base'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.FacilityDetails,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')

      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /maintenance-units/by-property-code/{code}:
   *   get:
   *     summary: Get maintenance units by property code.
   *     description: Returns all maintenance units belonging to a property.
   *     tags:
   *       - Property base Service
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the property for which to retrieve maintenance units.
   *     responses:
   *       200:
   *         description: Successfully retrieved the maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MaintenanceUnit'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/maintenance-units/by-property-code/:code', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { code } = ctx.params

    logger.info(metadata, `GET /maintenance-units/by-property-code/${code}`)

    try {
      const result =
        await propertyBaseAdapter.getMaintenanceUnitsByPropertyCode(code)
      if (!result.ok) {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting maintenance units from property-base'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies Array<schemas.MaintenanceUnit>,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
