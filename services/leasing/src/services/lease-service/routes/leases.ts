import KoaRouter from '@koa/router'
import { Contact, Lease, leasing } from '@onecore/types'
import {
  logger,
  generateRouteMetadata,
  setExcelDownloadHeaders,
  createExcelFromPaginated,
  joinField,
  formatDateForExcel,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import z from 'zod'

import {
  getContactByContactCode,
  getContactsByLeaseId,
  getLeasesForPropertyId,
  getContacts,
  getLeases,
} from '../adapters/xpand/tenant-lease-adapter'
import { createLease } from '../adapters/xpand/xpand-soap-adapter'
import {
  searchLeases,
  getBuildingManagers,
  getStatusLabel,
} from '../adapters/xpand/lease-search-adapter'

import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import * as tenfastHelpers from '../helpers/tenfast'
import { AdapterResult } from '../adapters/types'

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
      'buildingManager',
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
      // Create Excel using streaming - fetches pages incrementally
      const buffer =
        await createExcelFromPaginated<leasing.v1.LeaseSearchResult>(
          async (page: number, limit: number, totalCount?: number) => {
            // Use a derived context with overridden query instead of mutating ctx.query
            const paginationCtx = Object.create(ctx)
            paginationCtx.query = {
              ...ctx.query,
              page: String(page),
              limit: String(limit),
            }

            return await searchLeases(queryParams.data, paginationCtx, {
              forExport: true,
              totalCount,
            })
          },
          {
            sheetName: 'Hyreskontrakt',
            columns: [
              { header: 'Kontraktsnummer', key: 'leaseId', width: 18 },
              { header: 'Hyresgäst', key: 'tenantName', width: 30 },
              { header: 'Kundnummer', key: 'contactCode', width: 18 },
              { header: 'E-post', key: 'email', width: 30 },
              { header: 'Telefon', key: 'phone', width: 15 },
              { header: 'Objekttyp', key: 'objectType', width: 12 },
              { header: 'Kontraktstyp', key: 'leaseType', width: 20 },
              { header: 'Adress', key: 'address', width: 35 },
              { header: 'Fastighet', key: 'property', width: 20 },
              { header: 'Distrikt', key: 'district', width: 15 },
              { header: 'Startdatum', key: 'startDate', width: 12 },
              { header: 'Slutdatum', key: 'endDate', width: 12 },
              { header: 'Status', key: 'status', width: 15 },
            ],
            rowMapper: (lease: leasing.v1.LeaseSearchResult) => ({
              leaseId: lease.leaseId,
              tenantName: joinField(lease.contacts, (c) => c.name),
              contactCode: joinField(lease.contacts, (c) => c.contactCode),
              email: joinField(lease.contacts, (c) => c.email),
              phone: joinField(lease.contacts, (c) => c.phone),
              objectType: lease.objectTypeCode,
              leaseType: lease.leaseType,
              address: lease.address || '',
              property: lease.property || '',
              district: lease.districtName || '',
              startDate: formatDateForExcel(lease.startDate),
              endDate: formatDateForExcel(lease.lastDebitDate),
              status: getStatusLabel(lease.status),
            }),
            batchSize: 500,
          }
        )

      // 3. Set headers and return
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
   * /contacts/from-lease-search:
   *   get:
   *     summary: Get unique contacts matching lease filters
   *     description: Returns deduplicated contacts for all leases matching the given filters. Uses same filters as /leases/search but without pagination.
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
   *       - in: query
   *         name: startDateTo
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDateFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
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
   *       - in: query
   *         name: buildingManager
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building manager names
   *     responses:
   *       200:
   *         description: Unique contacts matching the filters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ContactInfo'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/contacts/from-lease-search', async (ctx) => {
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
      // Reuse searchLeases with paging to collect all unique contacts
      const contactMap = new Map<string, leasing.v1.ContactInfo>()
      let page = 1
      const batchSize = 500
      let totalCount: number | undefined

      while (true) {
        const paginationCtx = Object.create(ctx)
        paginationCtx.query = {
          ...ctx.query,
          page: String(page),
          limit: String(batchSize),
        }

        const result = await searchLeases(queryParams.data, paginationCtx, {
          totalCount,
        })

        totalCount = result._meta.totalRecords

        for (const lease of result.content) {
          for (const contact of lease.contacts ?? []) {
            if (!contactMap.has(contact.contactCode)) {
              contactMap.set(contact.contactCode, contact)
            }
          }
        }

        if (page * batchSize >= totalCount) break
        page++
      }

      ctx.status = 200
      ctx.body = { content: Array.from(contactMap.values()), ...metadata }
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error fetching contacts by filters')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error ? error.message : 'Failed to fetch contacts',
        ...metadata,
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
      const getLease = await tenfastAdapter.getLeaseByLeaseId(
        ctx.params.leaseId
      )

      if (!getLease.ok) {
        ctx.status = 500
        ctx.body = {
          error: getLease.err,
          ...metadata,
        }
        return
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
      console.log(error)
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
          'PARKING_SPACE',
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

  router.post('(.*)/leases/batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const leaseIds = (ctx.request.body as any).leaseIds as string[] // TODO schema

    try {
      const leases = await getLeases(leaseIds)

      ctx.status = 200
      ctx.body = {
        content: leases,
        ...metadata,
      }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  // TODO This should be replaced with the contacts microservice that is currently under construction
  router.post('(.*)/contacts/batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const contactCodes = (ctx.request.body as any).contactCodes as string[] // TODO schema

    try {
      const contacts = await getContacts(contactCodes)

      ctx.status = 200
      ctx.body = {
        content: contacts,
        ...metadata,
      }
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
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
   *         description: Invalid request body
   *       500:
   *         description: Internal server error. Failed to terminate lease.
   */

  const preliminaryTerminationSchema = z.object({
    contactCode: z.string(),
    lastDebitDate: z.string().datetime(),
    desiredMoveDate: z.string().datetime(),
  })

  router.post('(.*)/leases/:leaseId/preliminary-termination', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const bodyValidation = preliminaryTerminationSchema.safeParse(
      ctx.request.body
    )

    if (!bodyValidation.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        details: bodyValidation.error,
        ...metadata,
      }
      return
    }

    const { contactCode, lastDebitDate, desiredMoveDate } = bodyValidation.data

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
  })
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
