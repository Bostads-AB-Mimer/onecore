import KoaRouter from '@koa/router'
import {
  getLease,
  getLeasesForContactCode,
  getLeasesForNationalRegistrationNumber,
  getLeasesForPropertyId,
} from '../adapters/xpand/tenant-lease-adapter'
import { createLease } from '../adapters/xpand/xpand-soap-adapter'
import {
  searchLeases,
  getBuildingManagers,
  exportLeasesToExcel,
} from '../adapters/xpand/lease-search-adapter'
import {
  logger,
  generateRouteMetadata,
  setExcelDownloadHeaders,
} from '@onecore/utilities'
import { leasing } from '@onecore/types'
import z from 'zod'

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
   * /leases/export:
   *   get:
   *     summary: Export leases to Excel
   *     description: Export lease search results to Excel file. Uses same filters as /leases/search but without pagination.
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
   *         description: Object type codes
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Contract status filter
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
   *         description: Minimum end date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum end date (YYYY-MM-DD)
   *       - in: query
   *         name: property
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Property names
   *       - in: query
   *         name: districtNames
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: District names
   *     produces:
   *       - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   *     responses:
   *       200:
   *         description: Excel file download
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/leases/export', async (ctx) => {
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
      'buildingManagerCodes',
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
      const buffer = await exportLeasesToExcel(queryParams.data)
      setExcelDownloadHeaders(ctx, 'hyreskontrakt')
      ctx.body = buffer
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error exporting leases to Excel')
      ctx.status = 500
      ctx.body = {
        error: error instanceof Error ? error.message : 'Export failed',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/for/nationalRegistrationNumber/{pnr}:
   *   get:
   *     summary: Get leases by national registration number
   *     description: Retrieve leases associated with a national registration number (pnr).
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: The national registration number (pnr) of the contact.
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

  const getLeasesForPnrQueryParamSchema = z.object({
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
  })

  router.get('(.*)/leases/for/nationalRegistrationNumber/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeUpcomingLeases',
      'includeTerminatedLeases',
      'includeContacts',
    ])

    const queryParams = getLeasesForPnrQueryParamSchema.safeParse(ctx.query)
    if (queryParams.success === false) {
      ctx.status = 400
      return
    }

    const responseData = await getLeasesForNationalRegistrationNumber(
      ctx.params.pnr,
      {
        includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
        includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
        includeContacts: queryParams.data.includeContacts,
      }
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/for/contactCode/{contactCode}:
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
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *         description: Include terminated leases in the result.
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

  const getLeasesForContactCodeQueryParamSchema = z.object({
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
  })

  router.get('(.*)/leases/for/contactCode/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeUpcomingLeases',
      'includeTerminatedLeases',
      'includeContacts',
    ])

    const queryParams = getLeasesForContactCodeQueryParamSchema.safeParse(
      ctx.query
    )
    if (queryParams.success === false) {
      ctx.status = 400
      return
    }

    const result = await getLeasesForContactCode(ctx.params.pnr, {
      includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
      includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
      includeContacts: queryParams.data.includeContacts,
    })
    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: result.err,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: result.data,
      ...metadata,
    }
  })

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
  router.get('(.*)/leases/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeContacts'])
    const responseData = await getLease(
      ctx.params.id,
      ctx.query.includeContacts
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  interface CreateLeaseRequest {
    parkingSpaceId: string
    contactCode: string
    fromDate: string
    companyCode: string
  }

  /**
   * @swagger
   * /leases:
   *   post:
   *     summary: Create new lease in xpand for parking space
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
}
