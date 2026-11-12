import KoaRouter from '@koa/router'
import { Lease, leasing, schemas } from '@onecore/types'
import { mapLeasesToLfExportRows } from '../services/lf-export'
import { z } from 'zod'
import {
  getContacts,
  getContactByContactCode,
} from '../adapters/xpand/tenant-lease-adapter'
import {
  searchLeases,
  getParkingSpaceTypes,
} from '../adapters/xpand/lease-search-adapter'
import {
  logger,
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import * as tenfastLeaseSearchAdapter from '../adapters/tenfast/tenfast-lease-search-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { filterByStatus } from '../adapters/tenfast/filters'
import { boundTenfastCalls } from '../adapters/tenfast/tenfast-api'
import * as tenfastHelpers from '../helpers/tenfast'
import * as endedLeaseAdapter from '../adapters/xpand/ended-lease-adapter'
import { mergeTenfastFirst } from '../helpers/merge-tenfast-first'
import config from '../../../common/config'
import { TenfastLease, toYearMonthDayString } from '../adapters/tenfast/schemas'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

/**
 * @swagger
 * tags:
 *   - name: Leases
 *     description: Endpoints related to lease operations
 */

type KoaHttpErrorLike = {
  status: number
  message: string
  headers?: Record<string, string>
}

function isKoaHttpError(error: unknown): error is KoaHttpErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  )
}

const includesEnded = (statuses?: string[]) =>
  !statuses || statuses.length === 0 || statuses.includes('ended')

// A failed Xpand read must not break the page: log it and show Tenfast leases only.
const getEndedXpandLeases = async (
  promise:
    | ReturnType<typeof endedLeaseAdapter.getEndedLeasesByContactCode>
    | undefined,
  metadata: object
): Promise<Lease[]> => {
  if (!promise) return []
  const result = await promise
  if (!result.ok) {
    logger.error(
      { error: result.err, metadata },
      'Error fetching ended leases from Xpand'
    )
    return []
  }
  return result.data
}

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
   *         name: kvvAreaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: KVV-area codes (bafen.code) — filters leases to those in the listed förvaltningsområden
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
   *           maximum: 500
   *         description: Items per page
   *       - in: query
   *         name: includeEnded
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include Upphört (ended) contracts, including those that ended in Xpand before Tenfast. Excluded by default for performance.
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId, address, objectType, rentalObjectCode]
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
   *                       rentalObjectCode:
   *                         type: string
   *                         nullable: true
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
  /**
   * @swagger
   * /leases/parking-space-types:
   *   get:
   *     summary: Get all parking space types
   *     tags: [Leases]
   *     description: Returns a list of all parking space types (P-platstyper) from the babpt table.
   *     responses:
   *       '200':
   *         description: List of parking space types
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
   *                       code:
   *                         type: string
   *                       caption:
   *                         type: string
   *       '500':
   *         description: Internal server error
   */
  router.get('(.*)/leases/parking-space-types', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await getParkingSpaceTypes()
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (error) {
      logger.error({ err: error }, 'getParkingSpaceTypes')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred fetching parking space types',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/export:
   *   get:
   *     summary: Get all leases matching search filters, for export
   *     description: Returns the full (unpaginated) set of leases matching the same filters as /leases/search. Raw data only — contact enrichment and Excel generation happen in core.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, PNR, contact code, tenant name, rental object address)
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
   *     responses:
   *       200:
   *         description: Successfully retrieved leases. With ended in status, also holds leases that ended in Xpand before the move to Tenfast.
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *       503:
   *         description: A lease cache is still loading, or status includes ended and the Xpand ended leases are not loaded yet. Retry after the Retry-After header.
   */
  router.get('(.*)/leases/export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'objectType',
      'status',
      'leaseType',
      'startDateFrom',
      'startDateTo',
      'endDateFrom',
      'endDateTo',
      'property',
      'buildingCodes',
      'areaCodes',
      'districtNames',
      'kvvAreaCodes',
      'parkingSpaceType',
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
      const rawLeases = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        queryParams.data,
        ctx
      )

      ctx.status = 200
      ctx.body = { content: rawLeases, ...metadata }
    } catch (error: unknown) {
      // Set by hand — a re-thrown error hits errorHandler(), which always
      // forces status 500 regardless of the error's own status.
      if (isKoaHttpError(error)) {
        if (error.headers) ctx.set(error.headers)
        ctx.status = error.status
        ctx.body = { error: error.message, ...metadata }
        return
      }
      logger.error({ error, metadata }, 'Error fetching leases for export')
      ctx.status = 500
      ctx.body = {
        error: error instanceof Error ? error.message : 'Export failed',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/search:
   *   get:
   *     summary: Search and filter leases
   *     description: Search leases with comprehensive filtering options including text search, object type, status, date ranges. When status includes ended or includeEnded is true, results also hold leases that ended in Xpand before the move to Tenfast; Tenfast wins when both hold the same lease.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, PNR, contact code)
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Search by tenant name
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Search by rental object address
   *       - in: query
   *         name: objectType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Object type codes (bostad, parkering, lokal, ovrigt)
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [current, active, upcoming, abouttoend, ended, pendingsignature, preliminaryterminated, notsent]
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
   *         description: Property designations (fastighetsbeteckning)
   *       - in: query
   *         name: districtNames
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: District names (stadsdel)
   *       - in: query
   *         name: includeEnded
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include ended (Upphört) leases, including those that ended in Xpand before Tenfast.
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
   *           maximum: 500
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
   *                     $ref: '#/components/schemas/LeaseSearchResult'
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
   *       503:
   *         description: A lease cache is still loading, or status includes ended and the Xpand ended leases are not loaded yet. Retry after the Retry-After header. With only includeEnded=true and no Xpand ended leases loaded, the response holds Tenfast leases only.
   */
  router.get('(.*)/leases/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'name',
      'address',
      'objectType',
      'status',
      'property',
      'startDateFrom',
      'startDateTo',
      'endDateFrom',
      'endDateTo',
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
      const result = await tenfastLeaseSearchAdapter.searchLeases(
        queryParams.data,
        ctx
      )

      ctx.status = 200
      ctx.body = result
    } catch (error: unknown) {
      if (isKoaHttpError(error)) {
        if (error.headers) ctx.set(error.headers)
        ctx.status = error.status
        ctx.body = { error: error.message, ...metadata }
        return
      }

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
   *         name: kvvAreaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: KVV-area codes (bafen.code)
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
      'kvvAreaCodes',
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
   * /leases/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get leases by contact code
   *     description: Retrieve leases associated with a contact by contact code. Ended leases from before the move to Tenfast are read from Xpand and included.
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
   *         description: Comma-separated list of statuses to filter by. Valid values are current, upcoming, about-to-end, ended. Default is all statuses.
   *       - in: query
   *         name: includeSubletLeases
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Also return leases where the contact is the current sublet tenant (andrahandshyresgäst).
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */
  router.get('(.*)/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'status',
      'includeSubletLeases',
    ])

    const queryParams =
      leasing.v1.GetLeasesByContactCodeOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      logger.error(
        { error: queryParams.error, metadata },
        'Invalid query parameters for get leases by contact code'
      )
      ctx.status = 400
      ctx.body = { error: queryParams.error.issues, ...metadata }
      return
    }

    const filters = queryParams.data?.status
      ? { status: queryParams.data.status }
      : undefined

    const subletLeasesPromise = queryParams.data.includeSubletLeases
      ? tenfastAdapter.getSubletLeases(ctx.params.contactCode, filters)
      : undefined

    const endedXpandPromise = includesEnded(filters?.status)
      ? endedLeaseAdapter.getEndedLeasesByContactCode(ctx.params.contactCode)
      : undefined

    // TODO: NON-TENANT-CONTACTS/LEASE
    const contact = await tenfastAdapter.getTenantByContactCode(
      ctx.params.contactCode
    )

    if (!contact.ok) {
      logger.error(
        { error: contact.err, metadata },
        'Error fetching contact by contact code'
      )
      ctx.status = 500
      ctx.body = {
        error: contact.err,
        ...metadata,
      }

      return
    }

    let leases: TenfastLease[] = []

    if (contact.data) {
      const getLeases = await tenfastAdapter.getLeasesByTenantId(
        contact.data._id,
        filters
      )

      if (!getLeases.ok) {
        logger.error(
          { error: getLeases.err, metadata },
          'Error fetching leases by tenant ID'
        )
        ctx.status = 500
        ctx.body = {
          error: getLeases.err,
          ...metadata,
        }
        return
      }

      leases = getLeases.data
    } else {
      logger.info(
        { contactCode: ctx.params.contactCode },
        'No contact found by contact code'
      )
    }

    if (subletLeasesPromise) {
      const getSubletLeases = await subletLeasesPromise

      if (!getSubletLeases.ok) {
        logger.error(
          { error: getSubletLeases.err, metadata },
          'Error fetching sublet leases by contact code'
        )
        ctx.status = 500
        ctx.body = {
          error: getSubletLeases.err,
          ...metadata,
        }
        return
      }

      const leaseIds = new Set(leases.map((lease) => lease.externalId))
      leases = leases.concat(
        getSubletLeases.data.filter((lease) => !leaseIds.has(lease.externalId))
      )
    }

    // Dedupe Xpand against every Tenfast lease, not just the status-filtered ones.
    const tenfastIds = new Set(leases.map((lease) => lease.externalId))
    if (endedXpandPromise && filters && contact.ok && contact.data) {
      const allTenfast = await tenfastAdapter.getLeasesByTenantId(
        contact.data._id
      )
      if (allTenfast.ok) {
        allTenfast.data.forEach((lease) => tenfastIds.add(lease.externalId))
      }
    }

    const endedXpandLeases = (
      await getEndedXpandLeases(endedXpandPromise, metadata)
    ).filter((lease) => !tenfastIds.has(lease.leaseId.trim()))

    const onecoreLeases = mergeTenfastFirst(
      leases.map((lease) => tenfastHelpers.mapToOnecoreLease(lease)),
      endedXpandLeases
    )

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(onecoreLeases, metadata)
  })

  /**
   * @swagger
   * /leases/by-rental-object-code/{rentalObjectCode}:
   *   get:
   *     summary: Get leases by rental object code
   *     description: Retrieve leases associated with a rental object by rental object code. Ended leases from before the move to Tenfast are read from Xpand and included.
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
   *         description: Comma-separated list of statuses to filter by. Valid values are current, upcoming, about-to-end, ended, pending-signature, preliminary-terminated, not-sent. Default is all statuses.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases. Empty when the rental object has no leases matching the status filter.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       400:
   *         description: Invalid status filter.
   *       404:
   *         description: The rental object does not exist in Tenfast and has no ended leases in Xpand.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: rental-object-not-found
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   *       503:
   *         description: The rental object lookup in Tenfast failed, so it is unknown whether the object has leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: could-not-fetch-rental-object
   */
  router.get(
    '(.*)/leases/by-rental-object-code/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['status'])

      // TODO: NON-TENANT-CONTACTS/LEASES
      const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

      if (!queryParams.success) {
        ctx.status = 400
        ctx.body = { error: queryParams.error.issues, ...metadata }
        return
      }

      const statuses = queryParams.data.status

      const endedXpandPromise = includesEnded(statuses)
        ? endedLeaseAdapter.getEndedLeasesByRentalObjectCode(
            ctx.params.rentalObjectCode
          )
        : undefined

      const rentalObject = await tenfastAdapter.getRentalObject(
        ctx.params.rentalObjectCode
      )

      // A failed lookup says nothing about whether the object exists, so it
      // must not fall through to the 404 below: callers read that as "no
      // leases" and would show a rented object as vacant. The adapter has
      // already logged the failure.
      if (!rentalObject.ok) {
        // 503 when Tenfast could not be reached or answered with an error,
        // 500 when it answered with something we could not read.
        ctx.status =
          rentalObject.err === 'could-not-fetch-rental-object' ? 503 : 500
        ctx.body = { error: rentalObject.err, ...metadata }
        return
      }

      if (rentalObject.data === null) {
        const endedXpandLeases = await getEndedXpandLeases(
          endedXpandPromise,
          metadata
        )

        if (endedXpandLeases.length > 0) {
          ctx.status = 200
          ctx.body = makeSuccessResponseBody(endedXpandLeases, metadata)
          return
        }

        ctx.status = 404
        ctx.body = { error: 'rental-object-not-found', ...metadata }
        return
      }

      // Fetched without a status filter: Xpand is deduped against every
      // Tenfast lease, not just the ones the filter keeps.
      const getLeases = await tenfastAdapter.getLeasesByRentalPropertyId(
        rentalObject.data._id
      )

      if (!getLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: getLeases.err,
          ...metadata,
        }
        return
      }

      const tenfastIds = new Set(
        getLeases.data.map((lease) => lease.externalId)
      )
      const endedXpandLeases = (
        await getEndedXpandLeases(endedXpandPromise, metadata)
      ).filter((lease) => !tenfastIds.has(lease.leaseId.trim()))

      const tenfastLeases = statuses
        ? filterByStatus(getLeases.data, statuses)
        : getLeases.data

      const onecoreLeases = mergeTenfastFirst(
        tenfastLeases.map((lease) => tenfastHelpers.mapToOnecoreLease(lease)),
        endedXpandLeases
      )

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(onecoreLeases, metadata)
    }
  )

  /**
   * @swagger
   * /leases/lf-export:
   *   get:
   *     summary: Export home insurance data for Länsförsäkringar
   *     description: Returns leases with a home insurance rent row in states active, upcoming, preTermination, and terminationScheduled, with all fields needed for the daily LF export.
   *     tags: [Leases]
   *     responses:
   *       200:
   *         description: Successfully retrieved home insurance export data.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/leases/lf-export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await tenfastAdapter.getLeasesWithHomeInsurance()

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    const articleId = config.tenfast.leaseRentRows.homeInsurance.articleId
    const rows = mapLeasesToLfExportRows(result.data, articleId)

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(rows, metadata)
  })

  /**
   * @swagger
   * /leases/{id}:
   *   get:
   *     summary: Get detailed lease by lease ID
   *     description: Retrieve lease details by lease ID. Falls back to ended leases from before the move to Tenfast, read from Xpand, when Tenfast has no such lease.
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
   *         description: Successfully retrieved lease details.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: Lease details.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error. Failed to retrieve lease details.
   */
  router.get('(.*)/leases/:leaseId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      // TODO: NON-TENANT-CONTACTS/LEASE
      const getLease = await tenfastAdapter.getLeaseByLeaseId(
        ctx.params.leaseId
      )

      if (!getLease.ok) {
        if (getLease.err === 'not-found') {
          const ended = await endedLeaseAdapter.getEndedLeaseById(
            ctx.params.leaseId
          )

          if (ended.ok) {
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(ended.data, metadata)
            return
          }

          if (ended.err === 'unknown') {
            ctx.status = 500
            ctx.body = {
              error: ended.err,
              ...metadata,
            }
            return
          }

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

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(onecoreLease, metadata)
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
   *       400:
   *         description: fromDate is not a valid date (error invalid-from-date).
   *       409:
   *         description: >
   *           The rental object is not available from fromDate: it is leased
   *           then, or a next tenant has a lease on it that is signed or
   *           not yet signed. error is rental-object-not-available.
   *       500:
   *         description: Internal server error. Failed to create lease.
   */
  router.post('(.*)/leases', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const request = <CreateLeaseRequest>ctx.request.body

      // An invalid date compares as neither before nor after any date, so it
      // would slip past the availability check in createLease.
      const fromDate = new Date(request.fromDate)
      if (isNaN(fromDate.getTime())) {
        ctx.status = 400
        ctx.body = {
          error: 'invalid-from-date',
          ...metadata,
        }
        return
      }

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
        ctx.status = 404
        ctx.body = {
          error: 'Contact not found',
          ...metadata,
        }
        return
      }

      const createLeaseTenfastResult = await tenfastAdapter.createLease(
        contactResult.data,
        request.parkingSpaceId,
        fromDate,
        request.includeVAT
      )

      if (createLeaseTenfastResult.ok) {
        logger.info(
          { result: createLeaseTenfastResult.data },
          'Lease created in tenFAST'
        )
        ctx.body = {
          content: createLeaseTenfastResult.data,
          ...metadata,
        }
        return
      }

      if (createLeaseTenfastResult.err === 'rental-object-not-available') {
        ctx.status = 409
        ctx.body = {
          error: createLeaseTenfastResult.err,
          ...metadata,
        }
        return
      }

      logger.error(
        { error: createLeaseTenfastResult.err },
        'Error creating lease in tenFAST'
      )
      ctx.status = 500
      ctx.body = {
        error: createLeaseTenfastResult.err,
        ...metadata,
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

  router.post('(.*)/leases/batch', boundTenfastCalls, async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = (ctx.request.body ?? {}) as { leaseIds?: unknown }

    if (!Array.isArray(body.leaseIds)) {
      ctx.status = 400
      ctx.body = { error: 'leaseIds must be an array', ...metadata }
      return
    }

    const leaseIds = [...new Set(body.leaseIds as string[])]

    try {
      // Tenfast has no batch lookup, so fetch each lease the same way
      // GET /leases/:leaseId does, a few at a time. A lease that fails is
      // left out rather than failing the whole batch.
      const concurrency = 10
      const leases: Lease[] = []
      const notFoundLeaseIds: string[] = []
      const failedLeaseIds: string[] = []

      for (let i = 0; i < leaseIds.length; i += concurrency) {
        const chunk = leaseIds.slice(i, i + concurrency)
        const results = await Promise.all(
          chunk.map((leaseId) => tenfastAdapter.getLeaseByLeaseId(leaseId))
        )

        results.forEach((result, index) => {
          if (result.ok) {
            leases.push(tenfastHelpers.mapToOnecoreLease(result.data))
          } else if (result.err === 'not-found') {
            notFoundLeaseIds.push(chunk[index])
          } else {
            failedLeaseIds.push(chunk[index])
          }
        })
      }

      const summary = {
        requested: leaseIds.length,
        returned: leases.length,
        notFound: notFoundLeaseIds.length,
        failed: failedLeaseIds.length,
      }

      // Nothing came back and at least one lookup failed: most likely Tenfast
      // is down or rejecting us, so say so instead of answering with an
      // empty list that looks like "no leases".
      if (leases.length === 0 && failedLeaseIds.length > 0) {
        logger.error(
          { ...summary, failedLeaseIds },
          'POST /leases/batch: every Tenfast lookup failed'
        )
        ctx.status = 500
        ctx.body = { error: 'Could not get leases from Tenfast', ...metadata }
        return
      }

      if (failedLeaseIds.length > 0) {
        logger.error(
          { ...summary, failedLeaseIds },
          'POST /leases/batch: some leases could not be fetched from Tenfast'
        )
      } else if (notFoundLeaseIds.length > 0) {
        logger.info(
          { ...summary, notFoundLeaseIds },
          'POST /leases/batch: some leases were not found in Tenfast'
        )
      }

      ctx.status = 200
      ctx.body = {
        content: leases,
        ...metadata,
      }
    } catch (error: any) {
      logger.error(error, 'Error when getting lease batch')
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

      if (existingHomeInsurance && existingHomeInsurance.to == null) {
        ctx.status = 422
        ctx.body = {
          error:
            'Home insurance already exists and is not cancelled for this lease',
          ...metadata,
        }

        return
      }

      const updateHomeInsuranceResult =
        await tenfastAdapter.updateLeaseInvoiceRows({
          leaseId: ctx.params.leaseId,
          rowsToDelete: existingHomeInsurance?._id
            ? [existingHomeInsurance._id]
            : [],
          rowsToAdd: [
            {
              amount: ctx.request.body.monthlyAmount,
              article: config.tenfast.leaseRentRows.homeInsurance.articleId,
              label: 'Hemförsäkring',
              vat: 0, // No VAT on insurance
              from: toYearMonthDayString(ctx.request.body.from),
            },
          ],
        })

      if (!updateHomeInsuranceResult.ok) {
        ctx.status = 500
        ctx.body = {
          error: updateHomeInsuranceResult.err,
          ...metadata,
        }

        return
      }

      ctx.status = 201
      ctx.body = makeSuccessResponseBody(
        updateHomeInsuranceResult.data,
        metadata
      )
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
    ctx.body = makeSuccessResponseBody<
      z.infer<typeof schemas.v1.LeaseHomeInsuranceSchema>
    >(
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
   * /leases/{id}/home-insurance/cancel:
   *   post:
   *     summary: Cancel lease home insurance
   *     description: Cancel lease home insurance.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - endDate
   *             properties:
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: Desired end date for home insurance.
   *     responses:
   *       200:
   *         description: Successfully deleted home insurance.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error.
   */
  router.post(
    '(.*)/leases/:leaseId/home-insurance/cancel',
    parseRequestBody(leasing.v1.CancelLeaseHomeInsuranceRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const lease = await tenfastAdapter.getLeaseByExternalId(
        ctx.params.leaseId
      )
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

      const replaceLeaseInvoiceRow =
        await tenfastAdapter.updateLeaseInvoiceRows({
          leaseId: ctx.params.leaseId,
          rowsToDelete: [homeInsuranceRow._id],
          rowsToAdd: [
            {
              amount: homeInsuranceRow.amount,
              vat: homeInsuranceRow.vat,
              article: homeInsuranceRow.article,
              label: homeInsuranceRow.label,
              from: homeInsuranceRow.from ?? undefined,
              to: toYearMonthDayString(ctx.request.body.endDate),
            },
          ],
        })

      if (!replaceLeaseInvoiceRow.ok) {
        ctx.status = 500
        ctx.body = {
          error: replaceLeaseInvoiceRow.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(null, metadata)
    }
  )

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
   *               reason:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 60
   *                 default: Uppsägning av hyresgäst
   *                 description: The reason for the termination
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

      const { contactCode, lastDebitDate, desiredMoveDate, reason } = ctx
        .request.body as z.infer<
        typeof leasing.v1.PreliminaryTerminateLeaseRequestSchema
      >

      const result = await tenfastAdapter.preliminaryTerminateLease(
        ctx.params.leaseId,
        contactCode,
        new Date(lastDebitDate),
        new Date(desiredMoveDate),
        reason
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

        if (result.err === 'termination-not-required') {
          ctx.status = 400
          ctx.body = {
            error: result.err,
            message:
              'Lease expires within notice period, no termination required',
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
