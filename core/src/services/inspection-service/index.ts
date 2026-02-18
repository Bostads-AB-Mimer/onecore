import KoaRouter from '@koa/router'

import * as inspectionAdapter from '../../adapters/inspection-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as schemas from './schemas'
import { registerSchema } from '../../utils/openapi'

import { logger, generateRouteMetadata } from '@onecore/utilities'
import { generateInspectionProtocolPdf } from './helpers/pdf-generator'
import {
  identifyTenantContracts,
  sendProtocolToTenants,
} from './helpers/email-sender'
import { fetchEnrichedInspection } from './helpers/inspection-fetcher'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Inspection Service
 *     description: Operations related to inspections
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
  registerSchema('Inspection', schemas.InspectionSchema)
  registerSchema('InspectionRoom', schemas.InspectionRoomSchema)
  registerSchema('DetailedInspection', schemas.DetailedInspectionSchema)
  registerSchema('DetailedInspectionRoom', schemas.DetailedInspectionSchema)
  registerSchema('DetailedInspectionRemark', schemas.DetailedInspectionSchema)
  registerSchema('TenantContactsResponse', schemas.TenantContactsResponseSchema)
  registerSchema('SendProtocolRequest', schemas.SendProtocolRequestSchema)
  registerSchema('SendProtocolResponse', schemas.SendProtocolResponseSchema)
  registerSchema(
    'CreateInspectionRequest',
    schemas.CreateInspectionRequestSchema
  )

  /**
   * @swagger
   * /inspections/xpand:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Retrieve inspections from Xpand
   *     description: Retrieves inspections from Xpand with pagination and status filtering support.
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for pagination.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 25
   *         description: Maximum number of records to return.
   *       - in: query
   *         name: statusFilter
   *         schema:
   *           type: string
   *           enum: [ongoing, completed]
   *         description: Filter inspections by status (ongoing or completed).
   *       - in: query
   *         name: sortAscending
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Whether to sort the results in ascending order.
   *       - in: query
   *         name: inspector
   *         schema:
   *           type: string
   *         description: Filter inspections by inspector name.
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Filter inspections by address.
   *     responses:
   *       '200':
   *         description: Successfully retrieved inspections.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Inspection'
   *                 _meta:
   *                   type: object
   *                   properties:
   *                     totalRecords:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     count:
   *                       type: integer
   *                 _links:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       href:
   *                         type: string
   *                       rel:
   *                         type: string
   *       '400':
   *         description: Invalid query parameters.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Invalid query parameters
   *       '500':
   *         description: Internal server error. Failed to retrieve inspections.
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
  router.get('/inspections/xpand', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedParams = schemas.GetInspectionsFromXpandQuerySchema.safeParse(
      ctx.query
    )
    if (!parsedParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        ...metadata,
      }
      return
    }

    const { page, limit, statusFilter, sortAscending, inspector, address } =
      parsedParams.data

    try {
      const result = await inspectionAdapter.getXpandInspections({
        page,
        limit,
        statusFilter,
        sortAscending,
        inspector,
        address,
      })

      if (result.ok) {
        const inspections = result.data.content ?? []

        const leaseIds = inspections
          .filter(
            (inspection) =>
              inspection.leaseId !== null && inspection.leaseId !== ''
          )
          .map((inspection) => inspection.leaseId)

        const leasesById =
          leaseIds.length > 0
            ? await leasingAdapter.getLeases(leaseIds, 'true')
            : {}

        const inspectionsWithLeaseData = inspections.map((inspection) => ({
          ...inspection,
          lease: inspection.leaseId ? leasesById[inspection.leaseId] : null,
        }))

        ctx.status = 200
        ctx.body = {
          content: inspectionsWithLeaseData,
          _meta: result.data._meta,
          _links: result.data._links,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting inspections from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting inspections from xpand')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /inspections/xpand/residence/{residenceId}:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Retrieve inspections by residence ID from Xpand
   *     description: Retrieves inspections associated with a specific residence ID from Xpand.
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence to retrieve inspections for.
   *       - in: query
   *         name: statusFilter
   *         schema:
   *           type: string
   *           enum: [ongoing, completed]
   *         description: Filter inspections by status (ongoing or completed).
   *     responses:
   *       '200':
   *         description: Successfully retrieved inspections for the specified residence ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     inspections:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Inspection'
   *       '404':
   *         description: No inspections found for the specified residence ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: not-found
   *       '500':
   *         description: Internal server error. Failed to retrieve inspections.
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
  router.get('/inspections/xpand/residence/:residenceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { residenceId } = ctx.params

    const parsedQuery =
      schemas.GetInspectionsByResidenceIdQuerySchema.safeParse(ctx.query)
    const statusFilter = parsedQuery.success
      ? parsedQuery.data.statusFilter
      : undefined

    try {
      const result = await inspectionAdapter.getXpandInspectionsByResidenceId(
        residenceId,
        statusFilter
      )

      if (result.ok) {
        const leaseIds = result.data
          .filter(
            (inspection) =>
              inspection.leaseId !== null && inspection.leaseId !== ''
          )
          .map((inspection) => inspection.leaseId)

        const leasesById =
          leaseIds.length > 0
            ? await leasingAdapter.getLeases(leaseIds, 'true')
            : {}

        const inspectionsWithLeaseData = result.data.map((inspection) => ({
          ...inspection,
          lease: inspection.leaseId ? leasesById[inspection.leaseId] : null,
        }))

        ctx.status = 200
        ctx.body = {
          content: {
            inspections: inspectionsWithLeaseData,
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            residenceId,
            metadata,
          },
          'Error getting inspections by residenceId from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(
        { error, residenceId },
        'Error getting inspections by residenceId from xpand'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /inspections/xpand/{inspectionId}:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Retrieve an inspection by ID from Xpand
   *     description: Retrieves a specific inspection by its ID from Xpand.
   *     parameters:
   *       - in: path
   *         name: inspectionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the inspection to retrieve.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the inspection.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/DetailedInspection'
   *       '404':
   *         description: Inspection not found for the specified ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: not-found
   *       '500':
   *         description: Internal server error. Failed to retrieve the inspection.
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
  router.get('/inspections/xpand/:inspectionId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { inspectionId } = ctx.params

    try {
      const result = await fetchEnrichedInspection(inspectionId)

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: result.data,
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            inspectionId,
            metadata,
          },
          'Error getting inspection by id from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(
        { error, inspectionId },
        'Error getting inspection by id from xpand'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /inspections/xpand/{inspectionId}/pdf:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Generate PDF protocol for an inspection
   *     description: Generates and returns a PDF protocol for a specific inspection by its ID.
   *     parameters:
   *       - in: path
   *         name: inspectionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the inspection to generate a PDF for.
   *       - in: query
   *         name: includeCosts
   *         required: false
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Whether to include cost information in the PDF.
   *     responses:
   *       '200':
   *         description: Successfully generated PDF protocol.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     pdfBase64:
   *                       type: string
   *                       description: Base64 encoded PDF document
   *       '404':
   *         description: Inspection not found for the specified ID.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: not-found
   *       '500':
   *         description: Internal server error. Failed to generate PDF.
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
  router.get('/inspections/xpand/:inspectionId/pdf', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { inspectionId } = ctx.params
    const includeCosts = ctx.query.includeCosts !== 'false'

    try {
      const result = await fetchEnrichedInspection(inspectionId)

      if (result.ok) {
        const inspection = result.data

        let protocol
        try {
          protocol = await generateInspectionProtocolPdf(inspection, {
            includeCosts,
          })
        } catch (pdfError) {
          logger.error(
            {
              pdfError,
              errorMessage:
                pdfError instanceof Error ? pdfError.message : String(pdfError),
              errorStack:
                pdfError instanceof Error ? pdfError.stack : undefined,
              inspectionId,
            },
            'Error generating PDF protocol'
          )
          throw pdfError
        }

        ctx.status = 200
        ctx.body = {
          content: {
            pdfBase64: protocol.toString('base64'),
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            inspectionId,
            metadata,
          },
          'Error getting inspection by id from xpand for PDF generation'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(
        { error, inspectionId },
        'Error generating PDF protocol for inspection'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /inspections/{inspectionId}/tenant-contacts:
   *   get:
   *     tags:
   *       - Inspection Service
   *     summary: Get tenant contacts for inspection protocol modal
   *     description: Retrieves contact information for new and previous tenants to display in confirmation modal before sending protocol
   *     parameters:
   *       - in: path
   *         name: inspectionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The inspection ID
   *     responses:
   *       '200':
   *         description: Successfully retrieved tenant contacts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/TenantContactsResponse'
   *       '404':
   *         description: Inspection or residence not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Inspection not found
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
  router.get('/inspections/:inspectionId/tenant-contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { inspectionId } = ctx.params

    try {
      // Fetch inspection by ID
      const inspectionResult =
        await inspectionAdapter.getXpandInspectionById(inspectionId)

      if (!inspectionResult.ok) {
        logger.error(
          {
            err: inspectionResult.err,
            inspectionId,
          },
          'Error getting inspection by id for tenant contacts'
        )
        ctx.status = inspectionResult.statusCode || 500
        ctx.body = { error: inspectionResult.err, ...metadata }
        return
      }

      const inspection = inspectionResult.data

      // Fetch leases for the property
      const leases = await leasingAdapter.getLeasesForPropertyId(
        inspection.residenceId,
        {
          includeContacts: true,
          includeUpcomingLeases: true,
          includeTerminatedLeases: true,
        }
      )

      // Identify tenant contracts using inspection's leaseId
      const { newTenant, tenant } = identifyTenantContracts(
        leases,
        inspection.leaseId
      )

      // Build response
      const response: schemas.TenantContactsResponse = {
        inspection: {
          id: inspection.id,
          address: inspection.address,
          apartmentCode: inspection.apartmentCode,
        },
      }

      if (newTenant && newTenant.tenants) {
        response.new_tenant = {
          contacts: newTenant.tenants
            .filter((t) => t.emailAddress)
            .map((t) => ({
              fullName: t.fullName,
              emailAddress: t.emailAddress!,
              contactCode: t.contactCode,
            })),
          contractId: newTenant.leaseId,
        }
      }

      if (tenant && tenant.tenants) {
        response.tenant = {
          contacts: tenant.tenants
            .filter((t) => t.emailAddress)
            .map((t) => ({
              fullName: t.fullName,
              emailAddress: t.emailAddress!,
              contactCode: t.contactCode,
            })),
          contractId: tenant.leaseId,
        }
      }

      ctx.status = 200
      ctx.body = { content: response, ...metadata }
    } catch (error) {
      logger.error(
        { error, inspectionId },
        'Error retrieving tenant contacts for inspection'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /inspections/{inspectionId}/send-protocol:
   *   post:
   *     tags:
   *       - Inspection Service
   *     summary: Send inspection protocol to tenant
   *     description: Sends the inspection protocol PDF via email to the specified tenant (new or previous)
   *     parameters:
   *       - in: path
   *         name: inspectionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The inspection ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SendProtocolRequest'
   *     responses:
   *       '200':
   *         description: Protocol sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/SendProtocolResponse'
   *       '400':
   *         description: Invalid request or no contract found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Invalid request body
   *       '404':
   *         description: Inspection not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Inspection not found
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
  router.post('/inspections/:inspectionId/send-protocol', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { inspectionId } = ctx.params

    try {
      // Validate request body
      const validationResult = schemas.SendProtocolRequestSchema.safeParse(
        ctx.request.body
      )

      if (!validationResult.success) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid request body',
          details: validationResult.error.errors,
          ...metadata,
        }
        return
      }

      const { recipient } = validationResult.data

      // Fetch enriched inspection
      const inspectionResult = await fetchEnrichedInspection(inspectionId)

      if (!inspectionResult.ok) {
        logger.error(
          {
            err: inspectionResult.err,
            inspectionId,
          },
          'Error getting inspection by id for sending protocol'
        )
        ctx.status = inspectionResult.statusCode || 404
        ctx.body = { error: inspectionResult.err, ...metadata }
        return
      }

      const inspection = inspectionResult.data

      // Fetch all leases for the property
      const leases = await leasingAdapter.getLeasesForPropertyId(
        inspection.residenceId,
        {
          includeContacts: true,
          includeUpcomingLeases: true,
          includeTerminatedLeases: true,
        }
      )

      // Identify tenant contracts using inspection's leaseId
      const { newTenant, tenant } = identifyTenantContracts(
        leases,
        inspection.leaseId
      )

      // Select the requested contract
      const selectedContract = recipient === 'new-tenant' ? newTenant : tenant

      if (!selectedContract) {
        ctx.status = 400
        ctx.body = {
          content: {
            success: false,
            recipient,
            sentTo: {
              emails: [],
              contactNames: [],
              contractId: '',
            },
            error: `No contract found for ${recipient}`,
          },
          ...metadata,
        }
        return
      }

      // Verify contract has contacts with email addresses
      if (
        !selectedContract.tenants ||
        selectedContract.tenants.length === 0 ||
        !selectedContract.tenants.some((t) => t.emailAddress)
      ) {
        ctx.status = 400
        ctx.body = {
          content: {
            success: false,
            recipient,
            sentTo: {
              emails: [],
              contactNames: [],
              contractId: selectedContract.leaseId,
            },
            error: 'No email addresses found for tenant',
          },
          ...metadata,
        }
        return
      }

      // Generate PDF protocol
      let pdfBuffer: Buffer
      try {
        pdfBuffer = await generateInspectionProtocolPdf(inspection, {
          includeCosts: recipient !== 'new-tenant',
        })
      } catch (pdfError) {
        logger.error(
          {
            pdfError,
            errorMessage:
              pdfError instanceof Error ? pdfError.message : String(pdfError),
            errorStack: pdfError instanceof Error ? pdfError.stack : undefined,
            inspectionId,
          },
          'Error generating PDF protocol for sending'
        )
        ctx.status = 500
        ctx.body = {
          content: {
            success: false,
            recipient,
            sentTo: {
              emails: [],
              contactNames: [],
              contractId: selectedContract.leaseId,
            },
            error: 'Failed to generate PDF protocol',
          },
          ...metadata,
        }
        return
      }

      // Send protocol to tenants
      const result = await sendProtocolToTenants(
        inspection,
        pdfBuffer,
        selectedContract,
        recipient
      )

      ctx.status = 200
      ctx.body = {
        content: {
          success: result.success,
          recipient,
          sentTo: {
            emails: result.emails,
            contactNames: result.contactNames,
            contractId: result.contractId,
          },
          error: result.error,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, inspectionId }, 'Error sending inspection protocol')
      ctx.status = 500
      ctx.body = {
        content: {
          success: false,
          recipient: 'unknown',
          sentTo: {
            emails: [],
            contactNames: [],
            contractId: '',
          },
          error: 'Internal server error',
        },
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /inspections:
   *   post:
   *     tags:
   *       - Inspection Service
   *     summary: Create a new inspection
   *     description: Creates a new inspection in the local inspection database
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateInspectionRequest'
   *     responses:
   *       '201':
   *         description: Inspection created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     inspection:
   *                       $ref: '#/components/schemas/DetailedInspection'
   *       '400':
   *         description: Invalid request body
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *     security:
   *       - bearerAuth: []
   */
  router.post('/inspections', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await inspectionAdapter.createInspection(ctx.request.body)

      if (result.ok) {
        ctx.status = 201
        ctx.body = {
          content: {
            inspection: result.data,
          },
          ...metadata,
        }
      } else {
        ctx.status = 400
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error({ error }, 'Error creating inspection')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
