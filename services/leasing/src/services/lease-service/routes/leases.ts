import KoaRouter from '@koa/router'
import { z } from 'zod'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { Contact, Lease, leasing } from '@onecore/types'

import {
  getContactByContactCode,
  getContactsByLeaseId,
  getLeasesForPropertyId,
} from '../adapters/xpand/tenant-lease-adapter'
import { createLease } from '../adapters/xpand/xpand-soap-adapter'
import {
  searchLeases,
  getBuildingManagers,
} from '../adapters/xpand/lease-search-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import * as tenfastHelpers from '../helpers/tenfast'
import { AdapterResult } from '../adapters/types'
import config from '../../../common/config'
import { toYearMonthString } from '../adapters/tenfast/schemas'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

/**
 * @swagger
 * tags:
 *   - name: Leases
 *     description: Endpoints related to lease operations
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/search:
   *   get:
   *     summary: Search and filter leases
   *     description: Search leases with comprehensive filtering options including text search, object type, status, date ranges, and property hierarchy filters.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, tenant name, PNR, contact code, address)
   *       - in: query
   *         name: objectType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Object type codes (balgh, babps, balok)
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [current, upcoming, aboutToEnd, ended, "0", "1", "2", "3"]
   *         description: "Contract status filter (0=Current, 1=Upcoming, 2=AboutToEnd, 3=Ended)"
   *       - in: query
   *         name: startDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum start date (YYYY-MM-DD)
   *       - in: query
   *         name: startDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum start date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum last debit date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum last debit date (YYYY-MM-DD)
   *       - in: query
   *         name: property
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Property/estate names
   *       - in: query
   *         name: buildingCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building codes
   *       - in: query
   *         name: areaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Area codes (Område)
   *       - in: query
   *         name: districtNames
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: District names
   *       - in: query
   *         name: buildingManager
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building manager names (Kvartersvärd)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: Items per page
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId]
   *         description: Sort field
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort direction
   *     responses:
   *       200:
   *         description: Successfully retrieved lease search results with pagination
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
   *                       leaseId:
   *                         type: string
   *                       objectTypeCode:
   *                         type: string
   *                       leaseType:
   *                         type: string
   *                       contacts:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             name:
   *                               type: string
   *                             contactCode:
   *                               type: string
   *                             email:
   *                               type: string
   *                               nullable: true
   *                             phone:
   *                               type: string
   *                               nullable: true
   *                       address:
   *                         type: string
   *                         nullable: true
   *                       startDate:
   *                         type: string
   *                         format: date
   *                         nullable: true
   *                       lastDebitDate:
   *                         type: string
   *                         format: date
   *                         nullable: true
   *                       status:
   *                         type: integer
   *                         enum: [0, 1, 2, 3]
   *                         description: "LeaseStatus: 0=Current, 1=Upcoming, 2=AboutToEnd, 3=Ended"
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
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   */
  // TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
  router.get('(.*)/leases/building-managers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await getBuildingManagers()
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred fetching building managers',
        ...metadata,
      }
    }
  })

  router.get('(.*)/leases/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'objectType',
      'status',
      'startDateFrom',
      'startDateTo',
      'endDateFrom',
      'endDateTo',
      'property',
      'buildingCodes',
      'areaCodes',
      'districtNames',
      'buildingManager',
      'page',
      'limit',
      'sortBy',
      'sortOrder',
    ])

    const queryParams = leasing.v1.LeaseSearchQueryParamsSchema.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        details: queryParams.error.issues,
        ...metadata,
      }
      return
    }

    try {
      const result = await searchLeases(queryParams.data, ctx)

      ctx.status = 200
      ctx.body = result
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      } else {
        ctx.body = {
          error: 'Unknown error occurred during lease search',
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /leases/for/nationalRegistrationNumber/{pnr}:
   *   get:
   *     summary: Get leases by contact code
   *     description: Retrieve leases associated with a contact by contact code.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the contact.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: The status of the leases to include.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */
  router.get('(.*)/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['status', 'includeContacts'])

    const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { error: queryParams.error.issues, ...metadata }
      return
    }

    const contact = await tenfastAdapter.getTenantByContactCode(
      ctx.params.contactCode
    )

    if (!contact.ok) {
      ctx.status = 500
      ctx.body = {
        error: contact.err,
        ...metadata,
      }

      return
    }

    if (!contact.data) {
      ctx.status = 404
      ctx.body = {
        error: 'Contact not found',
        ...metadata,
      }
      return
    }

    const filters = queryParams.data?.status
      ? { status: queryParams.data.status }
      : undefined

    const getLeases = await tenfastAdapter.getLeasesByTenantId(
      contact.data._id,
      filters
    )

    if (!getLeases.ok) {
      ctx.status = 500
      ctx.body = {
        error: getLeases.err,
        ...metadata,
      }
      return
    }

    const onecoreLeases = getLeases.data.map(tenfastHelpers.mapToOnecoreLease)

    // TODO: When tenfast lease contains hyresgaster as contact codes, we can rewrite this
    if (!queryParams.data.includeContacts) {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(onecoreLeases, metadata)
    } else {
      const patchLeases = await patchLeasesWithContacts(onecoreLeases)
      if (!patchLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchLeases.err,
          ...metadata,
        }

        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(patchLeases.data, metadata)
    }
  })

  /**
   * @swagger
   * /leases/by-rental-object-code/{rentalObjectCode}:
   *   get:
   *     summary: Get leases by rental object code
   *     description: Retrieve leases associated with a rental object by rental object code.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the rental object.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: The status of the leases to include.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *       - in: query
   *         name: includeRentInfo
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Include rent information in the result. Defaults to true.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */
  router.get(
    '(.*)/leases/by-rental-object-code/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['status', 'includeContacts'])

      const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

      if (!queryParams.success) {
        ctx.status = 400
        ctx.body = { error: queryParams.error.issues, ...metadata }
        return
      }

      // TODO: TenFAST route is coming to get avtal by hyresobjekt
      // EDIT: or is it?
      const property = await tenfastAdapter.getRentalObject(
        ctx.params.rentalObjectCode
      )

      // TODO: Clean this up
      if (!property.ok && property.err === 'could-not-find-rental-object') {
        ctx.status = 404
        ctx.body = {
          error: 'Not found',
          ...metadata,
        }
        return
      }

      if (property.ok && property.data === null) {
        ctx.status = 404
        ctx.body = {
          error: 'Not found',
          ...metadata,
        }
        return
      }

      if (!property.ok) {
        ctx.status = 500
        ctx.body = {
          error: property.err,
          ...metadata,
        }
        return
      }

      if (!property.data) {
        throw 'ffs'
      }

      const getLeases = await tenfastAdapter.getLeasesByRentalPropertyId(
        property.data._id
      )

      if (!getLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: getLeases.err,
          ...metadata,
        }
        return
      }

      const onecoreLeases = getLeases.data.map(tenfastHelpers.mapToOnecoreLease)

      // TODO: When tenfast lease contains hyresgaster as contact codes, we can rewrite this
      if (!queryParams.data.includeContacts) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(onecoreLeases, metadata)
      } else {
        const patchLeases = await patchLeasesWithContacts(onecoreLeases)
        if (!patchLeases.ok) {
          ctx.status = 500
          ctx.body = {
            error: 'Not found',
            ...metadata,
          }

          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(patchLeases.data, metadata)
      }
    }
  )

  /**
   * @swagger
   * /leases/for/propertyId/{propertyId}:
   *   get:
   *     summary: Get leases by property ID
   *     description: Retrieve leases associated with a property by property ID.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the property.
   *       - in: query
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *         description: Include terminated leases in the result.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *       - in: query
   *         name: includeRentInfo
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Include rent information in the result. Defaults to true.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */

  const getLeasesForPropertyIdQueryParamSchema = z.object({
    includeUpcomingLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeTerminatedLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeContacts: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeRentInfo: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value !== 'false'), // defaults to true
  })

  router.get('(.*)/leases/for/propertyId/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeUpcomingLeases',
      'includeTerminatedLeases',
      'includeContacts',
      'includeRentInfo',
    ])

    const queryParams = getLeasesForPropertyIdQueryParamSchema.safeParse(
      ctx.query
    )
    if (queryParams.success === false) {
      ctx.status = 400
      return
    }

    const responseData = await getLeasesForPropertyId(ctx.params.propertyId, {
      includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
      includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
      includeContacts: queryParams.data.includeContacts,
      includeRentInfo: queryParams.data.includeRentInfo,
    })

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/{id}:
   *   get:
   *     summary: Get detailed lease by lease ID
   *     description: Retrieve lease details by lease ID.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *     responses:
   *       200:
   *         description: Successfully retrieved lease details.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: Lease details.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error. Failed to retrieve lease details.
   */
  router.get('(.*)/leases/:leaseId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeContacts'])
    const queryParams = leasing.v1.GetLeaseOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { error: queryParams.error.issues, ...metadata }
      return
    }

    try {
      const getLease = await tenfastAdapter.getLeaseByExternalId(
        ctx.params.leaseId
      )

      if (!getLease.ok) {
        if (getLease.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Lease not found',
            ...metadata,
          }

          return
        } else {
          ctx.status = 500
          ctx.body = {
            error: getLease.err,
            ...metadata,
          }

          return
        }
      }

      const onecoreLease = tenfastHelpers.mapToOnecoreLease(getLease.data)

      if (queryParams.data.includeContacts) {
        const contacts = await getContactsByLeaseId(onecoreLease.leaseId)
        const lease = { ...onecoreLease, tenants: contacts }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(lease, metadata)
      } else {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(onecoreLease, metadata)
      }
    } catch (error) {
      logger.error(error, 'Error when getting lease')
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
        ...metadata,
      }
    }
  })

  interface CreateLeaseRequest {
    parkingSpaceId: string
    contactCode: string
    fromDate: string
    companyCode: string
    includeVAT: boolean
  }

  /**
   * @swagger
   * /leases:
   *   post:
   *     summary: Create new lease for parking space
   *     description: Create a new lease for a parking space.
   *     tags: [Leases]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               parkingSpaceId:
   *                 type: string
   *                 description: The ID of the parking space for the lease.
   *               contactCode:
   *                 type: string
   *                 description: The contact code associated with the lease.
   *               fromDate:
   *                 type: string
   *                 format: date-time
   *                 description: The start date of the lease.
   *               companyCode:
   *                 type: string
   *                 description: The company code associated with the lease.
   *             required:
   *               - parkingSpaceId
   *               - contactCode
   *               - fromDate
   *               - companyCode
   *               - includeVAT
   *     responses:
   *       200:
   *         description: Lease created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 LeaseId:
   *                   type: string
   *                   description: The ID of the newly created lease.
   *       500:
   *         description: Internal server error. Failed to create lease.
   */
  router.post('(.*)/leases', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const request = <CreateLeaseRequest>ctx.request.body

      const createLeaseResult = await createLease(
        new Date(request.fromDate),
        request.parkingSpaceId,
        request.contactCode,
        request.companyCode
      )

      if (createLeaseResult.ok) {
        ctx.body = {
          content: createLeaseResult.data,
          ...metadata,
        }

        //Temporary: also create lease to tenfast
        const contactResult = await getContactByContactCode(
          request.contactCode,
          false
        )

        if (!contactResult.ok || !contactResult.data) {
          logger.error(
            {
              contactCode: request.contactCode,
              error: contactResult.ok ? undefined : contactResult.err,
            },
            'Could not retrieve contact to create tenFAST lease'
          )
          return
        }

        const createLeaseTenfastResult = await tenfastAdapter.createLease(
          contactResult.data,
          request.parkingSpaceId,
          new Date(request.fromDate),
          request.includeVAT
        )

        if (createLeaseTenfastResult.ok) {
          logger.info(
            { result: createLeaseTenfastResult.data },
            'Lease created in tenFAST'
          )
        } else {
          logger.error(
            { error: createLeaseTenfastResult.err },
            'Error creating lease in tenFAST'
          )
        }
      } else if (createLeaseResult.err === 'create-lease-not-allowed') {
        ctx.status = 404
        ctx.body = {
          error: 'Lease cannot be created on this rental object',
          ...metadata,
        }
      } else {
        ctx.status = 500
        ctx.body = {
          error: 'Unknown error when creating lease',
          ...metadata,
        }
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   post:
   *     summary: Add home insurance rent row to a lease
   *     description: Add a home insurance rent row. The article, VAT, amount, and label are determined by the service.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       201:
   *         description: Successfully added home insurance rent row.
   *       404:
   *         description: Lease not found.
   *       422:
   *         description: Home insurance rent row already exists for this lease.
   *       500:
   *         description: Internal server error.
   */
  router.post(
    '(.*)/leases/:leaseId/home-insurance',
    parseRequestBody(leasing.v1.AddLeaseHomeInsuranceRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const getCurrentLease = await tenfastAdapter.getLeaseByExternalId(
        ctx.params.leaseId
      )

      if (!getCurrentLease.ok) {
        if (getCurrentLease.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Lease not found',
            ...metadata,
          }

          return
        } else {
          ctx.status = 500
          ctx.body = {
            error: getCurrentLease.err,
            ...metadata,
          }

          return
        }
      }

      const existingHomeInsurance = getCurrentLease.data.hyror.find(
        (row) =>
          row.article === config.tenfast.leaseRentRows.homeInsurance.articleId
      )

      if (existingHomeInsurance) {
        ctx.status = 422
        ctx.body = {
          error: 'Home insurance rent row already exists for this lease',
          ...metadata,
        }

        return
      }

      const addHomeInsuranceResult = await tenfastAdapter.createLeaseInvoiceRow(
        {
          leaseId: ctx.params.leaseId,
          invoiceRow: {
            amount: ctx.request.body.monthlyAmount,
            article: config.tenfast.leaseRentRows.homeInsurance.articleId,
            label: 'Hemförsäkring', // TODO: Where should label be decided?
            vat: 0, // TODO: No VAT on insurance?
            // TODO: Mimer.nu lets you pick day that home insurance starts
            // but TenFAST only accepts yyyy-mm
            from: toYearMonthString(ctx.request.body.from),
          },
        }
      )

      if (!addHomeInsuranceResult.ok) {
        ctx.status = 500
        ctx.body = {
          error: addHomeInsuranceResult.err,
          ...metadata,
        }

        return
      }

      ctx.status = 201
      ctx.body = makeSuccessResponseBody(addHomeInsuranceResult.data, metadata)
    }
  )

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   get:
   *     summary: Get home insurance for a lease
   *     description: Returns home insurance details for a lease.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       200:
   *         description: Successfully retrieved home insurance.
   *       404:
   *         description: Lease or home insurance not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const getCurrentLease = await tenfastAdapter.getLeaseByExternalId(
      ctx.params.leaseId
    )

    if (!getCurrentLease.ok) {
      if (getCurrentLease.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          error: 'Lease not found',
          ...metadata,
        }

        return
      }

      ctx.status = 500
      ctx.body = {
        error: getCurrentLease.err,
        ...metadata,
      }

      return
    }

    const homeInsuranceRow = getCurrentLease.data.hyror.find(
      (row) =>
        row.article === config.tenfast.leaseRentRows.homeInsurance.articleId
    )

    if (!homeInsuranceRow) {
      ctx.status = 404
      ctx.body = {
        error: 'Home insurance not found',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(
      {
        monthlyAmount: homeInsuranceRow.amount,
        from: homeInsuranceRow.from ?? undefined,
        to: homeInsuranceRow.to ?? undefined,
      },
      metadata
    )
  })

  /**
   * @swagger
   * /leases/{id}/home-insurance:
   *   delete:
   *     summary: Delete lease home insurance
   *     description: Delete lease home insurance.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       200:
   *         description: Successfully deleted home insurance.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error.
   */
  router.delete('(.*)/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const lease = await tenfastAdapter.getLeaseByExternalId(ctx.params.leaseId)
    if (!lease.ok) {
      if (lease.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          error: 'Lease not found',
          ...metadata,
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        error: lease.err,
        ...metadata,
      }
      return
    }

    const homeInsuranceRow = lease.data.hyror.find(
      (row) =>
        row.article === config.tenfast.leaseRentRows.homeInsurance.articleId
    )

    if (!homeInsuranceRow || !homeInsuranceRow.article) {
      ctx.status = 404
      ctx.body = {
        error: 'Home insurance not found',
        ...metadata,
      }
      return
    }

    const deleteLeaseInvoiceRow = await tenfastAdapter.deleteLeaseInvoiceRow({
      leaseId: ctx.params.leaseId,
      invoiceRowId: homeInsuranceRow.article,
    })

    if (!deleteLeaseInvoiceRow.ok) {
      ctx.status = 500
      ctx.body = {
        error: deleteLeaseInvoiceRow.err,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(null, metadata)
  })

  /**
   * @swagger
   * /leases/{leaseId}/preliminary-termination:
   *   post:
   *     summary: Preliminary termination of a lease
   *     description: Initiates a preliminary termination for the specified lease in tenfast.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique identifier of the lease to terminate.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - contractNumber
   *               - contactCode
   *               - lastDebitDate
   *               - desiredMoveDate
   *             properties:
   *               contractNumber:
   *                 type: string
   *                 description: The contract number associated with the lease
   *               contactCode:
   *                 type: string
   *                 description: The contact code of the tenant
   *               lastDebitDate:
   *                 type: string
   *                 format: date-time
   *                 description: The last debit date for the lease
   *               desiredMoveDate:
   *                 type: string
   *                 format: date-time
   *                 description: The desired move-out date
   *     responses:
   *       200:
   *         description: Preliminary termination initiated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         description: Invalid request body or tenant missing valid email address
   *       404:
   *         description: Lease not found
   *       500:
   *         description: Internal server error. Failed to terminate lease.
   */

  router.post(
    '(.*)/leases/:leaseId/preliminary-termination',
    parseRequestBody(leasing.v1.PreliminaryTerminateLeaseRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const { contactCode, lastDebitDate, desiredMoveDate } = ctx.request
        .body as z.infer<
        typeof leasing.v1.PreliminaryTerminateLeaseRequestSchema
      >

      const result = await tenfastAdapter.preliminaryTerminateLease(
        ctx.params.leaseId,
        contactCode,
        new Date(lastDebitDate),
        new Date(desiredMoveDate)
      )

      if (!result.ok) {
        if (result.err === 'lease-not-found') {
          ctx.status = 404
          ctx.body = {
            error: result.err,
            message: 'Lease not found',
            ...metadata,
          }
          return
        }

        if (result.err === 'tenant-email-missing') {
          ctx.status = 400
          ctx.body = {
            error: result.err,
            message: 'Tenant missing valid email address',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: result.err,
          message: 'Failed to terminate lease',
          ...metadata,
        }

        ctx.status = 500
        ctx.body = {
          error: result.err,
          message: 'Failed to terminate lease',
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    }
  )
}

async function patchLeasesWithContacts(
  leases: Lease[]
): Promise<AdapterResult<Lease[], 'no-contact' | 'unknown'>> {
  for (const lease of leases) {
    if (!lease.tenantContactIds) {
      continue
    }

    let contacts: Contact[] = []
    for (const contactCode of lease.tenantContactIds) {
      const contact = await getContactByContactCode(contactCode, false)
      if (!contact.ok || !contact.data) {
        return { ok: false, err: 'no-contact' }
      }

      contacts.push(contact.data)
    }

    lease.tenants = contacts
  }

  return { ok: true, data: leases }
}
