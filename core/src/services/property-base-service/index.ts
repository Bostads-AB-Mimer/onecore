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
  registerSchema('Component', schemas.ComponentSchema)
  registerSchema('ComponentCategory', schemas.ComponentCategorySchema)
  registerSchema('ComponentType', schemas.ComponentTypeSchema)
  registerSchema('ComponentSubtype', schemas.ComponentSubtypeSchema)
  registerSchema('ComponentModel', schemas.ComponentModelSchema)
  registerSchema('ComponentInstance', schemas.ComponentNewSchema)
  registerSchema('ComponentInstallation', schemas.ComponentInstallationSchema)
  registerSchema(
    'CreateComponentCategoryRequest',
    schemas.CreateComponentCategorySchema
  )
  registerSchema(
    'UpdateComponentCategoryRequest',
    schemas.UpdateComponentCategorySchema
  )
  registerSchema(
    'CreateComponentTypeRequest',
    schemas.CreateComponentTypeSchema
  )
  registerSchema(
    'UpdateComponentTypeRequest',
    schemas.UpdateComponentTypeSchema
  )
  registerSchema(
    'CreateComponentSubtypeRequest',
    schemas.CreateComponentSubtypeSchema
  )
  registerSchema(
    'UpdateComponentSubtypeRequest',
    schemas.UpdateComponentSubtypeSchema
  )
  registerSchema(
    'CreateComponentModelRequest',
    schemas.CreateComponentModelSchema
  )
  registerSchema(
    'UpdateComponentModelRequest',
    schemas.UpdateComponentModelSchema
  )
  registerSchema('CreateComponentRequest', schemas.CreateComponentNewSchema)
  registerSchema('UpdateComponentRequest', schemas.UpdateComponentNewSchema)
  registerSchema(
    'CreateComponentInstallationRequest',
    schemas.CreateComponentInstallationSchema
  )
  registerSchema(
    'UpdateComponentInstallationRequest',
    schemas.UpdateComponentInstallationSchema
  )
  registerSchema('DocumentWithUrl', schemas.DocumentWithUrlSchema)
  registerSchema(
    'AnalyzeComponentImageRequest',
    schemas.AnalyzeComponentImageRequestSchema
  )
  registerSchema('AIComponentAnalysis', schemas.AIComponentAnalysisSchema)

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
        logger.error({ err: result.err, metadata }, 'Internal server error')
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
   * /companies:
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
   *       - in: query
   *         name: includeActiveBlocksOnly
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: If true, only include active rental blocks (started and not ended). If false, include all rental blocks.
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
    const queryParams = schemas.GetResidenceDetailsQueryParamsSchema.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { error: queryParams.error.errors, ...metadata }
      return
    }

    const { includeActiveBlocksOnly } = queryParams.data

    try {
      const getResidence = await propertyBaseAdapter.getResidenceDetails(
        residenceId,
        { includeActiveBlocksOnly }
      )

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
   * /components/by-room/{roomId}:
   *   get:
   *     summary: Get components by room ID
   *     tags:
   *       - Property base Service
   *     description: |
   *       Retrieves all component instances associated with a specific room ID.
   *       Components are returned ordered by installation date (newest first).
   *     parameters:
   *       - in: path
   *         name: roomId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the room
   *     responses:
   *       '200':
   *         description: Successfully retrieved the components list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentInstance'
   *       '404':
   *         description: Room not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Room not found
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
  router.get('(.*)/components/by-room/:roomId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { roomId } = ctx.params

    try {
      const result = await propertyBaseAdapter.getComponentsByRoomId(roomId)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Room not found', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentNew[],
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

  /**
   * @swagger
   * /facilities/by-property-code/{propertyCode}:
   *   get:
   *     summary: Get facilities by property code.
   *     description: Returns all facilities belonging to a property.
   *     tags:
   *       - Property base Service
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the property for which to retrieve facilities.
   *     responses:
   *       200:
   *         description: Successfully retrieved the facilities.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *       404:
   *         description: Facilities not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/facilities/by-property-code/:propertyCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { propertyCode } = ctx.params

    logger.info(metadata, `GET /facilities/by-property-code/${propertyCode}`)

    try {
      const result =
        await propertyBaseAdapter.getFacilitiesByPropertyCode(propertyCode)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Facilities not found', ...metadata }
          return
        }

        logger.error(
          { err: result.err, metadata },
          'Error getting facilities from property-base'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies Array<schemas.FacilityDetails>,
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
   * /facilities/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get facilities by building code.
   *     description: Returns all facilities belonging to a building.
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
   *         description: The code of the building for which to retrieve facilities.
   *     responses:
   *       200:
   *         description: Successfully retrieved the facilities.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *       404:
   *         description: Facilities not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/facilities/by-building-code/:buildingCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { buildingCode } = ctx.params

    logger.info(metadata, `GET /facilities/by-building-code/${buildingCode}`)

    try {
      const result =
        await propertyBaseAdapter.getFacilitiesByBuildingCode(buildingCode)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Facilities not found', ...metadata }
          return
        }

        logger.error(
          { err: result.err, metadata },
          'Error getting facilities from property-base'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies Array<schemas.FacilityDetails>,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT CATEGORIES ====================

  /**
   * @swagger
   * /component-categories:
   *   get:
   *     summary: Get all component categories
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component categories
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentCategory'
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-categories', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const page = Number(ctx.query.page) || 1
    const limit = Number(ctx.query.limit) || 20

    try {
      const result = await propertyBaseAdapter.getComponentCategories(
        page,
        limit
      )

      if (!result.ok) {
        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data,
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
   * /component-categories/{id}:
   *   get:
   *     summary: Get component category by ID
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component category details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *       404:
   *         description: Component category not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { id } = ctx.params

    try {
      const result = await propertyBaseAdapter.getComponentCategoryById(id)

      if (!result.ok) {
        if (result.err === 'not_found') {
          ctx.status = 404
          ctx.body = { error: 'Component category not found', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data,
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
   * /component-categories:
   *   post:
   *     summary: Create a new component category
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentCategoryRequest'
   *     responses:
   *       201:
   *         description: Component category created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-categories', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const data = schemas.CreateComponentCategorySchema.parse(ctx.request.body)

    try {
      const result = await propertyBaseAdapter.createComponentCategory(data)

      if (!result.ok) {
        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 201
      ctx.body = {
        content: result.data,
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
   * /component-categories/{id}:
   *   put:
   *     summary: Update a component category
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentCategoryRequest'
   *     responses:
   *       200:
   *         description: Component category updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *       404:
   *         description: Component category not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { id } = ctx.params
    const data = schemas.UpdateComponentCategorySchema.parse(ctx.request.body)

    try {
      const result = await propertyBaseAdapter.updateComponentCategory(id, data)

      if (!result.ok) {
        if (result.err === 'not_found') {
          ctx.status = 404
          ctx.body = { error: 'Component category not found', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data,
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
   * /component-categories/{id}:
   *   delete:
   *     summary: Delete a component category
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component category deleted successfully
   *       404:
   *         description: Component category not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { id } = ctx.params

    try {
      const result = await propertyBaseAdapter.deleteComponentCategory(id)

      if (!result.ok) {
        if (result.err === 'not_found') {
          ctx.status = 404
          ctx.body = { error: 'Component category not found', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT TYPES ====================

  /**
   * @swagger
   * /component-types:
   *   get:
   *     summary: Get all component types
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: categoryId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter types by category ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component types
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentType'
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-types', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentTypesQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentTypes(
        params.data.categoryId,
        params.data.page,
        params.data.limit
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType[],
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
   * /component-types/{id}:
   *   get:
   *     summary: Get component type by ID
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component type details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentType'
   *       404:
   *         description: Component type not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-types/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentTypeById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component type not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType,
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
   * /component-types:
   *   post:
   *     summary: Create a new component type
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentTypeRequest'
   *     responses:
   *       201:
   *         description: Component type created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentType'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-types', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentTypeSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentType(body.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType,
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
   * /component-types/{id}:
   *   put:
   *     summary: Update a component type
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentTypeRequest'
   *     responses:
   *       200:
   *         description: Component type updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentType'
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-types/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentTypeSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentType(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component type not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType,
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
   * /component-types/{id}:
   *   delete:
   *     summary: Delete a component type
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component type deleted
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-types/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentType(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component type not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT SUBTYPES ====================

  /**
   * @swagger
   * /component-subtypes:
   *   get:
   *     summary: Get all component subtypes
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: typeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter subtypes by type ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component subtypes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentSubtype'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-subtypes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentSubtypesQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentSubtypes(
        params.data.typeId,
        params.data.page,
        params.data.limit,
        params.data.subtypeName
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype[],
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
   * /component-subtypes/{id}:
   *   get:
   *     summary: Get component subtype by ID
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component subtype details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentSubtype'
   *       404:
   *         description: Component subtype not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-subtypes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentSubtypeById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component subtype not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype,
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
   * /component-subtypes:
   *   post:
   *     summary: Create a new component subtype
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentSubtypeRequest'
   *     responses:
   *       201:
   *         description: Component subtype created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentSubtype'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-subtypes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentSubtypeSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentSubtype(body.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype,
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
   * /component-subtypes/{id}:
   *   put:
   *     summary: Update a component subtype
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentSubtypeRequest'
   *     responses:
   *       200:
   *         description: Component subtype updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentSubtype'
   *       404:
   *         description: Component subtype not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-subtypes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentSubtypeSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentSubtype(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component subtype not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype,
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
   * /component-subtypes/{id}:
   *   delete:
   *     summary: Delete a component subtype
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component subtype deleted
   *       404:
   *         description: Component subtype not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-subtypes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentSubtype(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component subtype not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT MODELS ====================

  /**
   * @swagger
   * /component-models:
   *   get:
   *     summary: Get all component models
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: componentTypeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter models by component type ID
   *       - in: query
   *         name: subtypeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter models by subtype ID
   *       - in: query
   *         name: manufacturer
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter models by manufacturer name
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component models
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentModel'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-models', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentModelsQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentModels(
        params.data.componentTypeId,
        params.data.subtypeId,
        params.data.manufacturer,
        params.data.page,
        params.data.limit,
        params.data.modelName
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel[],
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
   * /api/documents/component-models/{id}:
   *   get:
   *     summary: Get all documents for a component model
   *     tags:
   *       - Documents
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component model ID
   *     responses:
   *       200:
   *         description: Array of documents with presigned URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DocumentWithUrl'
   *       404:
   *         description: Component model not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/documents/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentModelDocuments(
        id.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = result.data
    } catch (error) {
      logger.error(
        { error, metadata },
        'Failed to get component model documents'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-models/{id}:
   *   get:
   *     summary: Get component model by ID
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component model details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   *       404:
   *         description: Component model not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentModelById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel,
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
   * /component-models:
   *   post:
   *     summary: Create a new component model
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentModelRequest'
   *     responses:
   *       201:
   *         description: Component model created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-models', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentModelSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentModel(body.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel,
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
   * /component-models/{id}:
   *   put:
   *     summary: Update a component model
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentModelRequest'
   *     responses:
   *       200:
   *         description: Component model updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   *       404:
   *         description: Component model not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentModelSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentModel(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel,
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
   * /component-models/{id}:
   *   delete:
   *     summary: Delete a component model
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component model deleted
   *       404:
   *         description: Component model not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentModel(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENTS ====================

  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Get all component instances
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: modelId
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED]
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component instances
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentInstance'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/components', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentsNewQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponents(
        params.data.modelId,
        params.data.status,
        params.data.page,
        params.data.limit,
        params.data.serialNumber
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentNew[],
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
   * /components/{id}:
   *   get:
   *     summary: Get component instance by ID
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component instance details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstance'
   *       404:
   *         description: Component instance not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentNew,
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
   * /components:
   *   post:
   *     summary: Create a new component instance
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentRequest'
   *     responses:
   *       201:
   *         description: Component instance created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstance'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/components', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentNewSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponent({
        ...body.data,
        warrantyStartDate: body.data.warrantyStartDate?.toISOString(),
      })

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentNew,
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
   * /components/{id}:
   *   put:
   *     summary: Update a component instance
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentRequest'
   *     responses:
   *       200:
   *         description: Component instance updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstance'
   *       404:
   *         description: Component instance not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentNewSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponent(id.data, {
        ...body.data,
        warrantyStartDate: body.data.warrantyStartDate?.toISOString(),
      })

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentNew,
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
   * /components/{id}:
   *   delete:
   *     summary: Delete a component instance
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component instance deleted
   *       404:
   *         description: Component instance not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponent(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT INSTALLATIONS ====================

  /**
   * @swagger
   * /component-installations:
   *   get:
   *     summary: Get all component installations
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: query
   *         name: componentId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: spaceId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: buildingPartId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component installations
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentInstallation'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-installations', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentInstallationsQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentInstallations(
        params.data.componentId,
        params.data.spaceId,
        undefined,
        params.data.page,
        params.data.limit
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation[],
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
   * /component-installations/{id}:
   *   get:
   *     summary: Get component installation by ID
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component installation details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstallation'
   *       404:
   *         description: Component installation not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentInstallationById(
        id.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component installation not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation,
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
   * /component-installations:
   *   post:
   *     summary: Create a new component installation
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentInstallationRequest'
   *     responses:
   *       201:
   *         description: Component installation created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstallation'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-installations', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentInstallationSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentInstallation({
        ...body.data,
        installationDate: body.data.installationDate.toISOString(),
        deinstallationDate: body.data.deinstallationDate?.toISOString(),
      })

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation,
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
   * /component-installations/{id}:
   *   put:
   *     summary: Update a component installation
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component installation ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentInstallationRequest'
   *     responses:
   *       200:
   *         description: Component installation updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstallation'
   *       404:
   *         description: Component installation not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentInstallationSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentInstallation(
        id.data,
        {
          ...body.data,
          installationDate: body.data.installationDate?.toISOString(),
          deinstallationDate: body.data.deinstallationDate?.toISOString(),
        }
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component installation not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation,
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
   * /component-installations/{id}:
   *   delete:
   *     summary: Delete a component installation
   *     tags:
   *       - Property base Service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component installation deleted
   *       404:
   *         description: Component installation not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentInstallation(
        id.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component installation not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT FILE UPLOAD ROUTES ====================

  /**
   * @swagger
   * /api/components/{id}/upload:
   *   post:
   *     summary: Upload a file to a component
   *     tags:
   *       - Components New
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component ID
   *       - in: query
   *         name: caption
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional caption for the file
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/components/:id/upload', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const caption = z.string().optional().safeParse(ctx.query.caption)

    try {
      const file = ctx.request.files?.file

      if (!file || Array.isArray(file)) {
        ctx.status = 400
        ctx.body = { error: 'Single file required', ...metadata }
        return
      }

      // Read file buffer (koa-body stores files on disk)
      const fs = await import('fs')
      const fileBuffer = await fs.promises.readFile(file.filepath)

      const result = await propertyBaseAdapter.uploadComponentFile(
        id.data,
        fileBuffer,
        file.originalFilename || 'unknown',
        file.mimetype || 'application/octet-stream',
        caption.success ? caption.data : undefined
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Upload failed', ...metadata }
        return
      }

      ctx.body = { content: result.data, ...metadata }
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to upload component file')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /api/documents/component-instances/{id}:
   *   get:
   *     summary: Get all documents for a component instance
   *     tags:
   *       - Documents
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     responses:
   *       200:
   *         description: Array of documents with presigned URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DocumentWithUrl'
   *       404:
   *         description: Component not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/documents/component-instances/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentFiles(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = result.data
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to get component files')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /api/documents/{id}:
   *   delete:
   *     summary: Delete a document by ID
   *     tags:
   *       - Documents
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Document ID
   *     responses:
   *       204:
   *         description: Document deleted successfully
   *       404:
   *         description: Document not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/documents/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid document ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentFile(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Document not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to delete document')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT MODEL DOCUMENT UPLOAD ROUTES ====================

  /**
   * @swagger
   * /api/component-models/{id}/upload:
   *   post:
   *     summary: Upload a document to a component model
   *     tags:
   *       - Component Models
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component model ID
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: Document uploaded successfully
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-models/:id/upload', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const file = ctx.request.files?.file

      if (!file || Array.isArray(file)) {
        ctx.status = 400
        ctx.body = { error: 'Single file required', ...metadata }
        return
      }

      // Read file buffer (koa-body stores files on disk)
      const fs = await import('fs')
      const fileBuffer = await fs.promises.readFile(file.filepath)

      // Normalize Swedish characters to ASCII equivalents
      // This avoids encoding issues entirely by removing non-ASCII characters
      const normalizeFilename = (filename: string): string => {
        return filename
          .replace(/Ö/g, 'O')
          .replace(/Ä/g, 'A')
          .replace(/Å/g, 'A')
          .replace(/ö/g, 'o')
          .replace(/ä/g, 'a')
          .replace(/å/g, 'a')
      }

      const originalFilename = file.originalFilename || 'unknown'
      const normalizedFilename = normalizeFilename(originalFilename)

      const result = await propertyBaseAdapter.uploadComponentModelDocument(
        id.data,
        fileBuffer,
        normalizedFilename,
        file.mimetype || 'application/octet-stream'
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Upload failed', ...metadata }
        return
      }

      ctx.body = { content: result.data, ...metadata }
    } catch (error) {
      logger.error(
        { error, metadata },
        'Failed to upload component model document'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /api/documents/upload:
   *   post:
   *     summary: Upload a document for a component instance or model
   *     tags:
   *       - Documents
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *               componentInstanceId:
   *                 type: string
   *                 format: uuid
   *               componentModelId:
   *                 type: string
   *                 format: uuid
   *               caption:
   *                 type: string
   *     responses:
   *       200:
   *         description: Document uploaded successfully
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/documents/upload', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const file = ctx.request.files?.file

      if (!file || Array.isArray(file)) {
        ctx.status = 400
        ctx.body = { error: 'Single file required', ...metadata }
        return
      }

      const body = ctx.request.body as {
        componentInstanceId?: string
        componentModelId?: string
        caption?: string
      }

      if (!body.componentInstanceId && !body.componentModelId) {
        ctx.status = 400
        ctx.body = {
          error: 'Either componentInstanceId or componentModelId required',
          ...metadata,
        }
        return
      }

      // Read file buffer (koa-body stores files on disk)
      const fs = await import('fs')
      const fileBuffer = await fs.promises.readFile(file.filepath)

      let result
      if (body.componentInstanceId) {
        result = await propertyBaseAdapter.uploadComponentFile(
          body.componentInstanceId,
          fileBuffer,
          file.originalFilename || 'unknown',
          file.mimetype || 'application/octet-stream',
          body.caption
        )
      } else {
        result = await propertyBaseAdapter.uploadComponentModelDocument(
          body.componentModelId!,
          fileBuffer,
          file.originalFilename || 'unknown',
          file.mimetype || 'application/octet-stream'
        )
      }

      if (!result.ok) {
        ctx.status = result.err === 'bad_request' ? 400 : 500
        ctx.body = {
          error:
            result.err === 'bad_request'
              ? 'Invalid upload request'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = result.data
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to upload document')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /components/analyze-image:
   *   post:
   *     summary: Analyze component image(s) using AI
   *     description: Analyzes one or two images of Swedish appliances (vitvaror) using AI to extract component information. Can accept a typeplate/label image, product photo, or both for improved accuracy.
   *     tags:
   *       - Property base Service
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AnalyzeComponentImageRequest'
   *     responses:
   *       200:
   *         description: Component analysis successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/AIComponentAnalysis'
   *       400:
   *         description: Invalid request (e.g., image too large, missing required fields)
   *       500:
   *         description: AI analysis failed
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/components/analyze-image', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.AnalyzeComponentImageRequestSchema.safeParse(
      ctx.request.body
    )

    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.analyzeComponentImage(body.data)

      if (!result.ok) {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.AIComponentAnalysis,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
