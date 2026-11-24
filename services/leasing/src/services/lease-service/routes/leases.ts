import KoaRouter from '@koa/router'
import { Lease, leasing } from '@onecore/types'
import { mapLeasesToLfExportRows } from '../services/lf-export'
import * as rentRowsService from '../services/lease-rent-rows'
import * as leaseCache from '../../../common/lease-cache'
import { z } from 'zod'
import {
  getContacts,
  getContactByContactCode,
} from '../adapters/xpand/tenant-lease-adapter'
import { getParkingSpaceTypes } from '../adapters/xpand/lease-search-adapter'
import {
  logger,
  generateRouteMetadata,
  makeSuccessResponseBody,
  buildPaginationLinks,
  PaginatedResponse,
} from '@onecore/utilities'

import * as tenfastLeaseSearchAdapter from '../adapters/tenfast/tenfast-lease-search-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { filterByStatus } from '../adapters/tenfast/filters'
import { boundTenfastCalls } from '../adapters/tenfast/tenfast-api'
import * as tenfastHelpers from '../helpers/tenfast'
import * as endedLeaseAdapter from '../adapters/xpand/ended-lease-adapter'
import { mergeTenfastFirst } from '../helpers/merge-tenfast-first'
import config from '../../../common/config'
import {
  TenfastInvoiceRow,
  TenfastLease,
  toYearMonthDayString,
  YearMonthDayStringSchema,
} from '../adapters/tenfast/schemas'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import {
  checkHomeInsuranceWrite,
  hasOpenOrUpcomingHomeInsuranceRow,
  HomeInsuranceReplacementRow,
  HomeInsuranceWriteCheck,
  planHomeInsuranceCancel,
  planHomeInsuranceEnd,
  selectCurrentHomeInsuranceRow,
  toHomeInsuranceRow,
} from '../services/home-insurance'
import { homeInsuranceCache } from '../services/home-insurance-cache'
import {
  homeInsuranceListLinkParams,
  listAllHomeInsuranceItems,
  listHomeInsuranceItems,
} from '../services/home-insurance-list'
import { getLeaseStatuses } from '../services/lease-statuses'

// Seconds a client waits before asking again while the home insurance list
// or the lease cache loads for the first time.
const HOME_INSURANCE_LIST_RETRY_AFTER_SECONDS = '30'
const LEASE_CACHE_RETRY_AFTER_SECONDS = '30'

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

type HomeInsuranceError = {
  status: number
  error: leasing.HomeInsuranceErrorCode
}

// A failed read of the lease. The adapter has logged it.
const homeInsuranceLeaseReadError = (err: unknown): HomeInsuranceError =>
  err === 'not-found'
    ? { status: 404, error: 'lease-not-found' }
    : { status: 503, error: 'upstream-failed' }

// row-changed: a row the write was to remove is no longer on the lease.
type HomeInsuranceRowsWriteError =
  tenfastAdapter.UpdateLeaseInvoiceRowsError | 'row-changed'

// A failed write of the lease's rent rows. It has been logged.
const homeInsuranceRowsWriteError = (
  err: HomeInsuranceRowsWriteError
): HomeInsuranceError => {
  if (err === 'not-found') return { status: 404, error: 'lease-not-found' }
  if (err === 'row-changed') {
    return { status: 409, error: 'home-insurance-row-changed' }
  }
  return { status: 503, error: 'upstream-failed' }
}

/**
 * Writes the lease's home insurance rent rows. Tenfast refuses the whole
 * write with 400, and adds nothing, when a row in rowsToDelete is no longer
 * on the lease (checked against Tenfast test). That is how a write at the
 * same time on the same row shows, so it can never leave a duplicate row.
 * The 400 has no code that says so, and its message is not matched: the
 * lease is read again instead. A row to remove that is gone gives
 * row-changed; otherwise the 400 is a real failure.
 */
const writeHomeInsuranceRows = async (params: {
  leaseId: string
  rowsToDelete: string[]
  rowsToAdd: HomeInsuranceReplacementRow[]
}): Promise<{ ok: true } | { ok: false; err: HomeInsuranceRowsWriteError }> => {
  const { leaseId, rowsToDelete } = params
  const write = await tenfastAdapter.updateLeaseInvoiceRows(params)
  if (write.ok) return { ok: true }
  // The adapter has logged everything but a 400.
  if (write.err !== 'bad-request') return { ok: false, err: write.err }

  if (rowsToDelete.length > 0) {
    const lease = await tenfastAdapter.getLeaseByExternalId(leaseId)
    if (!lease.ok) {
      logger.error(
        { leaseId, error: lease.err },
        'home-insurance: Tenfast refused the rows, and the lease could not be read again to find out why'
      )
      return { ok: false, err: 'upstream-failed' }
    }

    const rowIds = new Set(lease.data.hyror.map((row) => row._id))
    if (rowsToDelete.some((rowId) => !rowIds.has(rowId))) {
      homeInsuranceCache.replaceLease(lease.data)
      logger.warn(
        { leaseId, rowsToDelete },
        'home-insurance: a row to replace was changed by someone else'
      )
      return { ok: false, err: 'row-changed' }
    }
  }

  logger.error({ leaseId }, 'home-insurance: Tenfast refused the rows')
  return { ok: false, err: 'bad-request' }
}

const sendHomeInsuranceError = (
  ctx: { status: number; body: unknown },
  { status, error }: HomeInsuranceError,
  metadata: object
) => {
  ctx.status = status
  ctx.body = { error, ...metadata }
}

/**
 * The leases with home insurance from the list cache. Answers 503 itself
 * (cache-warming with Retry-After, or upstream-failed) and returns undefined
 * when they cannot be read.
 */
const readHomeInsuranceListLeases = async (
  ctx: {
    status: number
    body: unknown
    set: (field: string, value: string) => void
  },
  metadata: object
): Promise<TenfastLease[] | undefined> => {
  const cached = await homeInsuranceCache.getLeases()
  if (cached.ok) return cached.leases

  const error: leasing.HomeInsuranceListErrorCode = cached.err
  if (error === 'cache-warming') {
    ctx.set('Retry-After', HOME_INSURANCE_LIST_RETRY_AFTER_SECONDS)
  }
  ctx.status = 503
  ctx.body = { error, ...metadata }
  return undefined
}

/**
 * Reads the lease again after a write to its home insurance rows, puts it in
 * the list cache, and checks that the rows are what the write meant to leave.
 * Tenfast has no conditional write, so this is how a write made at the same
 * time is found. When the lease cannot be read again, the list cache reloads
 * on its next read.
 */
const readBackHomeInsuranceWrite = async (params: {
  leaseId: string
  rowsBefore: TenfastInvoiceRow[]
  removedRowIds: string[]
  written: HomeInsuranceReplacementRow | null
}): Promise<
  { ok: true; check: HomeInsuranceWriteCheck } | { ok: false; err: unknown }
> => {
  const leaseAfter = await tenfastAdapter.getLeaseByExternalId(params.leaseId)
  if (!leaseAfter.ok) {
    homeInsuranceCache.invalidate()
    return { ok: false, err: leaseAfter.err }
  }

  homeInsuranceCache.replaceLease(leaseAfter.data)
  return {
    ok: true,
    check: checkHomeInsuranceWrite({
      rowsBefore: params.rowsBefore,
      rowsAfter: leaseAfter.data.hyror,
      articleId: config.tenfast.leaseRentRows.homeInsurance.articleId,
      removedRowIds: params.removedRowIds,
      written: params.written,
    }),
  }
}

/**
 * Logs what the read-back of a Mina sidor write found. The write itself has
 * succeeded and Mina sidor needs 200 for it, so the answer stays 200. A
 * mismatch means a row was added at the same time, such as two adds on a
 * lease without a home insurance row (nothing to remove, so Tenfast cannot
 * refuse either); it is logged with the ids of the rows added, for someone to
 * remove a duplicate by hand.
 */
const logMinaSidorHomeInsuranceReadBack = (
  readBack: Awaited<ReturnType<typeof readBackHomeInsuranceWrite>>,
  context: { leaseId: string; route: string }
) => {
  if (!readBack.ok) {
    logger.warn(
      { ...context, error: readBack.err },
      'home-insurance: written, but the lease could not be read again to check the write'
    )
    return
  }
  if (!readBack.check.ok) {
    logger.error(
      {
        ...context,
        reason: readBack.check.reason,
        addedRowIds: readBack.check.addedRowIds,
      },
      'home-insurance: the rows after the write are not what it meant to leave, check the lease for a duplicate row'
    )
  }
}

export const routes = (router: KoaRouter) => {
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
   *         name: parkingSpaceType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Parking-space type codes (babpt.code), from GET /leases/parking-space-types
   *       - in: query
   *         name: leaseType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [Bostadskontrakt, Lokalkontrakt, Garagekontrakt, P-Platskontrakt, Övrigt]
   *         description: "Contract type (Kontraktstyp) filter. Garagekontrakt and P-Platskontrakt are derived from the parking space's type in Xpand: a parking lease on a space with a garage type is a Garagekontrakt, any other parking lease a P-Platskontrakt. Rows carry the derived value only in a request that filters on one of those two, and in the export; elsewhere Tenfast parking leases show P-Platskontrakt. Övrigt matches every contract type not listed. Leases that ended in Xpand keep the contract type they had there. If the parking-space types cannot be read from Xpand, a request that needs them fails with 500 instead of returning unfiltered or underived rows."
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
   *         name: parkingSpaceType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Parking-space type codes (babpt.code), from GET /leases/parking-space-types
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [current, active, upcoming, abouttoend, ended, pendingsignature, preliminaryterminated, notsent]
   *         description: Contract status filter
   *       - in: query
   *         name: leaseType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [Bostadskontrakt, Lokalkontrakt, Garagekontrakt, P-Platskontrakt, Övrigt]
   *         description: "Contract type (Kontraktstyp) filter. Garagekontrakt and P-Platskontrakt are derived from the parking space's type in Xpand: a parking lease on a space with a garage type is a Garagekontrakt, any other parking lease a P-Platskontrakt. Rows carry the derived value only in a request that filters on one of those two, and in the export; elsewhere Tenfast parking leases show P-Platskontrakt. Övrigt matches every contract type not listed. Leases that ended in Xpand keep the contract type they had there. If the parking-space types cannot be read from Xpand, a request that needs them fails with 500 instead of returning unfiltered or underived rows."
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
   *         name: kvvAreaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: KVV-area codes (bafen.code) — filters leases to those in the listed förvaltningsområden
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
   *           enum: [leaseStartDate, lastDebitDate, leaseId, address, objectType, rentalObjectCode, tenantName]
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
      'leaseType',
      'parkingSpaceType',
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
   *     description: Returns the contacts on every lease that /leases/search lists for the same filters, one per contact code and without pagination. Reads the same leases as /leases/search, so the two always agree. Phone and email are not filled in for tenants; the caller gets them from the contacts service.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, rental object code, address, contact code, tenant name)
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
   *         name: parkingSpaceType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Parking-space type codes (babpt.code), from GET /leases/parking-space-types
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [current, active, upcoming, abouttoend, ended, pendingsignature, preliminaryterminated, notsent]
   *         description: Contract status filter
   *       - in: query
   *         name: leaseType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [Bostadskontrakt, Lokalkontrakt, Garagekontrakt, P-Platskontrakt, Övrigt]
   *         description: "Contract type (Kontraktstyp) filter. Garagekontrakt and P-Platskontrakt are derived from the parking space's type in Xpand: a parking lease on a space with a garage type is a Garagekontrakt, any other parking lease a P-Platskontrakt. Rows carry the derived value only in a request that filters on one of those two, and in the export; elsewhere Tenfast parking leases show P-Platskontrakt. Övrigt matches every contract type not listed. Leases that ended in Xpand keep the contract type they had there. If the parking-space types cannot be read from Xpand, a request that needs them fails with 500 instead of returning unfiltered or underived rows."
   *       - in: query
   *         name: includeEnded
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include ended (Upphört) leases, including those that ended in Xpand before Tenfast.
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
   *       503:
   *         description: A lease cache is still loading, or status includes ended and the Xpand ended leases are not loaded yet. Retry after the Retry-After header.
   */
  router.get('(.*)/contacts/from-lease-search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'name',
      'address',
      'objectType',
      'status',
      'leaseType',
      'parkingSpaceType',
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
      const contacts =
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          queryParams.data,
          ctx
        )

      ctx.status = 200
      ctx.body = { content: contacts, ...metadata }
    } catch (error: unknown) {
      // Set by hand — a re-thrown error hits errorHandler(), which always
      // forces status 500 regardless of the error's own status.
      if (isKoaHttpError(error)) {
        if (error.headers) ctx.set(error.headers)
        ctx.status = error.status
        ctx.body = { error: error.message, ...metadata }
        return
      }
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
   * /leases/home-insurances:
   *   get:
   *     summary: List home insurance rows for staff
   *     description: >
   *       Lists home insurance rent rows on leases in states active, upcoming,
   *       preTermination and terminationScheduled, filtered, sorted and paged.
   *       rows=lf lists the rows of the Länsförsäkringar file, one per lease.
   *       rows=all lists every home insurance row, including company tenants,
   *       negative amounts and rows without a first day, for quality checks.
   *       Items carry the tenant's contactCode only, never a name or personal
   *       identity number. The leases are held in memory per pod for up to
   *       five minutes; writes through this service show at once on the pod
   *       that made them.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Matches leaseId, rentalObjectCode, contactCode and the rental object's address, ignoring case.
   *       - in: query
   *         name: contactCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         style: form
   *         explode: false
   *         description: Only rows whose contactCode is one of these, comma-separated or repeated. Given but empty, it matches nothing.
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: ['G', 'K', '*']
   *         style: form
   *         explode: false
   *         description: Only rows with one of these Länsförsäkringar statuses (G in force, K lease to come, * the row has an end date).
   *       - in: query
   *         name: rows
   *         schema:
   *           type: string
   *           enum: [lf, all]
   *           default: lf
   *       - in: query
   *         name: sameDate
   *         schema:
   *           type: boolean
   *         description: Only rows whose first and last day are the same day. Meant for rows=all.
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseId, leaseStatus, leaseFromDate, leaseToDate, rentalObjectCode, address, rowFromDate, rowToDate, monthlyAmount, contactCode]
   *           default: leaseId
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 500
   *           default: 50
   *     responses:
   *       200:
   *         description: One page of the list. No match gives an empty content array. Empty values sort last; ties are ordered by leaseId and rowId.
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
   *                       leaseStatus:
   *                         type: string
   *                         enum: ['G', 'K', '*']
   *                       leaseStage:
   *                         type: integer
   *                         description: The lease's LeaseStatus.
   *                       leaseFromDate:
   *                         type: string
   *                         format: date
   *                       leaseToDate:
   *                         type: string
   *                         format: date
   *                         nullable: true
   *                       rentalObjectCode:
   *                         type: string
   *                         nullable: true
   *                       numberOfRooms:
   *                         type: number
   *                         nullable: true
   *                       squareMeters:
   *                         type: number
   *                         nullable: true
   *                       address:
   *                         type: string
   *                         nullable: true
   *                       postalCode:
   *                         type: string
   *                         nullable: true
   *                       city:
   *                         type: string
   *                         nullable: true
   *                       rowId:
   *                         type: string
   *                       rowFromDate:
   *                         type: string
   *                         format: date
   *                         nullable: true
   *                       rowToDate:
   *                         type: string
   *                         format: date
   *                         nullable: true
   *                       monthlyAmount:
   *                         type: number
   *                       articleText:
   *                         type: string
   *                       contactCode:
   *                         type: string
   *                         nullable: true
   *                       isCompany:
   *                         type: boolean
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
   *         description: Invalid query parameters (error invalid-query).
   *       503:
   *         description: >
   *           The leases are loading from Tenfast for the first time (error
   *           cache-warming, retry after the Retry-After header), or Tenfast
   *           could not be read (error upstream-failed).
   */
  router.get('(.*)/leases/home-insurances', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const query = leasing.HomeInsuranceListQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!query.success) {
      const error: leasing.HomeInsuranceListErrorCode = 'invalid-query'
      ctx.status = 400
      ctx.body = { error, details: query.error.issues, ...metadata }
      return
    }

    const leases = await readHomeInsuranceListLeases(ctx, metadata)
    if (!leases) return

    const params = query.data
    const { content, totalRecords } = listHomeInsuranceItems(
      leases,
      config.tenfast.leaseRentRows.homeInsurance.articleId,
      params
    )
    const body: PaginatedResponse<leasing.HomeInsuranceListItem> = {
      content,
      _meta: {
        totalRecords,
        page: params.page,
        limit: params.limit,
        count: content.length,
      },
      _links: buildPaginationLinks(
        ctx,
        params.page,
        params.limit,
        Math.ceil(totalRecords / params.limit),
        homeInsuranceListLinkParams(params)
      ),
    }

    ctx.status = 200
    ctx.body = body
  })

  /**
   * @swagger
   * /leases/home-insurances/all:
   *   get:
   *     summary: List every matching home insurance row for staff, unpaged
   *     description: >
   *       The items of GET /leases/home-insurances that match the query, all
   *       of them and in the same order, from one read of the cache, for an
   *       export. Takes the same query parameters except page and limit.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *       - in: query
   *         name: contactCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: ['G', 'K', '*']
   *       - in: query
   *         name: rows
   *         schema:
   *           type: string
   *           enum: [lf, all]
   *           default: lf
   *       - in: query
   *         name: sameDate
   *         schema:
   *           type: boolean
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           default: leaseId
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
   *     responses:
   *       200:
   *         description: Every matching item, as in GET /leases/home-insurances. No match gives an empty content array.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *       400:
   *         description: Invalid query parameters (error invalid-query).
   *       503:
   *         description: >
   *           The leases are loading from Tenfast for the first time (error
   *           cache-warming, retry after the Retry-After header), or Tenfast
   *           could not be read (error upstream-failed).
   */
  router.get('(.*)/leases/home-insurances/all', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const query = leasing.HomeInsuranceListAllQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!query.success) {
      const error: leasing.HomeInsuranceListErrorCode = 'invalid-query'
      ctx.status = 400
      ctx.body = { error, details: query.error.issues, ...metadata }
      return
    }

    const leases = await readHomeInsuranceListLeases(ctx, metadata)
    if (!leases) return

    ctx.status = 200
    ctx.body = makeSuccessResponseBody<leasing.HomeInsuranceListItem[]>(
      listAllHomeInsuranceItems(
        leases,
        config.tenfast.leaseRentRows.homeInsurance.articleId,
        query.data
      ),
      metadata
    )
  })

  /**
   * @swagger
   * /leases/statuses:
   *   post:
   *     summary: Get the status of many leases
   *     description: >
   *       The status of each lease, read from the lease cache in one go. A
   *       lease the cache does not hold, such as an archived one, is read
   *       from Tenfast. If any of those reads fails the answer is 503, never
   *       a list with the lease left out.
   *     tags: [Leases]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [leaseIds]
   *             properties:
   *               leaseIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: The status of each lease Tenfast has, and the lease IDs it has no lease for.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     statuses:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           leaseId:
   *                             type: string
   *                           status:
   *                             type: integer
   *                             description: The lease's LeaseStatus.
   *                     notFoundLeaseIds:
   *                       type: array
   *                       items:
   *                         type: string
   *       400:
   *         description: The request body is invalid.
   *       503:
   *         description: >
   *           The lease cache is loading for the first time (error
   *           cache-warming, retry after the Retry-After header), or a lease
   *           could not be read from Tenfast (error upstream-failed).
   */
  router.post(
    '(.*)/leases/statuses',
    parseRequestBody(leasing.LeaseStatusesRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await getLeaseStatuses(ctx.request.body.leaseIds)
      if (!result.ok) {
        if (result.err === 'cache-warming') {
          ctx.set('Retry-After', LEASE_CACHE_RETRY_AFTER_SECONDS)
        }
        ctx.status = 503
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody<leasing.LeaseStatusesResponse>(
        result.data,
        metadata
      )
    }
  )

  /**
   * @swagger
   * /leases/rent-rows:
   *   get:
   *     summary: List rent rows (avtalsrader) of all leases
   *     description: |
   *       One item per rent row, served from the lease cache. Filter on lease
   *       status, free text (lease id, contact code, article code, label, row
   *       id) or kind of row. Leave out page to get every matching row.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema: { type: string }
   *       - in: query
   *         name: status
   *         schema: { type: array, items: { type: string } }
   *       - in: query
   *         name: filter
   *         schema: { type: string, enum: [homeInsurance, sameDate] }
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: limit
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Rent rows.
   *       400:
   *         description: Invalid query parameters.
   *       503:
   *         description: Lease cache is warming up.
   */
  router.get('(.*)/leases/rent-rows', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'status',
      'filter',
      'page',
      'limit',
    ])

    const queryParams = leasing.v1.LeaseRentRowsQueryParamsSchema.safeParse(
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
    const params = queryParams.data

    const leases = await tenfastLeaseSearchAdapter.readFreshLeaseCache()
    if (!leases) {
      ctx.set('Retry-After', '30')
      ctx.status = 503
      ctx.body = {
        error: 'Lease cache is warming up — retry shortly',
        ...metadata,
      }
      return
    }

    // Articles only add code and timestamps for display, so a failed
    // lookup still returns the rows, with those fields empty.
    const articles = await tenfastAdapter.getArticles().catch((error) => {
      logger.warn({ error }, 'rent-rows: could not fetch articles')
      return []
    })

    const items = rentRowsService.filterRentRowListItems(
      rentRowsService.toRentRowListItems(
        leases,
        articles,
        config.tenfast.leaseRentRows.homeInsurance.articleId
      ),
      params
    )

    const limit = params.limit ?? 100
    const content = params.page
      ? items.slice((params.page - 1) * limit, params.page * limit)
      : items
    const body: leasing.v1.LeaseRentRowsResponse = {
      content,
      _meta: {
        totalRecords: items.length,
        page: params.page ?? 1,
        limit: params.page ? limit : items.length,
        count: content.length,
        syncedAt: leaseCache.getCacheInfo().lastSyncedAt?.toISOString() ?? null,
      },
    }

    ctx.status = 200
    ctx.body = { ...body, ...metadata }
  })

  /**
   * @swagger
   * /leases/{leaseId}/rent-rows/home-insurance-end-date:
   *   post:
   *     summary: Change T.o.m. (end date) of a home insurance rent row
   *     description: |
   *       Only rows with the home insurance article can be changed. Tenfast
   *       can't edit a row in place, so the row is replaced by an identical
   *       one with the new end date, which gets a new row id. Returns the
   *       lease's rent rows as they are in Tenfast after the change.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [rowId, endDate]
   *             properties:
   *               rowId: { type: string }
   *               endDate: { type: string, format: date }
   *     responses:
   *       200:
   *         description: Changed. Body has the lease's rent rows.
   *       404:
   *         description: Lease or row not found.
   *       422:
   *         description: Row is not home insurance, end date is before start or unchanged.
   *       500:
   *         description: Tenfast error.
   */
  router.post(
    '(.*)/leases/:leaseId/rent-rows/home-insurance-end-date',
    parseRequestBody(leasing.v1.SetHomeInsuranceEndDateRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const leaseId = ctx.params.leaseId
      const homeInsuranceArticleId =
        config.tenfast.leaseRentRows.homeInsurance.articleId

      const lease = await tenfastAdapter.getLeaseByExternalId(leaseId)
      if (!lease.ok) {
        const notFound = lease.err === 'not-found'
        if (notFound) {
          logger.warn({ leaseId }, 'rent-rows: lease not found')
        } else {
          logger.error(
            { leaseId, err: lease.err },
            'rent-rows: could not fetch lease'
          )
        }
        const error: leasing.v1.SetHomeInsuranceEndDateError = notFound
          ? 'lease-not-found'
          : 'lease-fetch-failed'
        ctx.status = notFound ? 404 : 500
        ctx.body = { error, ...metadata }
        return
      }

      const planned = rentRowsService.planHomeInsuranceEndDate(
        lease.data,
        ctx.request.body,
        homeInsuranceArticleId
      )
      if (!planned.ok) {
        ctx.status = planned.err === 'row-not-found' ? 404 : 422
        ctx.body = { error: planned.err, ...metadata }
        return
      }

      const oldRow = lease.data.hyror.find(
        (r) => r._id === ctx.request.body.rowId
      )
      const update = await tenfastAdapter.updateLeaseInvoiceRows({
        leaseId,
        ...planned.plan,
      })
      if (!update.ok) {
        // updateLeaseInvoiceRows already logged the failure
        const error: leasing.v1.SetHomeInsuranceEndDateError = 'update-failed'
        ctx.status = 500
        ctx.body = { error, ...metadata }
        return
      }

      logger.info(
        {
          leaseId,
          rowId: ctx.request.body.rowId,
          oldTo: oldRow?.to ?? null,
          newTo: ctx.request.body.endDate,
          ...metadata,
        },
        'rent-rows: home insurance end date changed in Tenfast'
      )

      // Read the lease back so the answer shows what Tenfast actually saved,
      // and update the cache so the list shows it without waiting for sync.
      const updated = await tenfastAdapter.getLeaseByExternalId(leaseId)
      if (!updated.ok) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(
          { changed: true, rentRows: null },
          metadata
        )
        return
      }
      const cached = tenfastLeaseSearchAdapter.updateCachedLease(updated.data)
      const articles = await tenfastAdapter.getArticles().catch(() => [])

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        {
          changed: true,
          rentRows: rentRowsService.toRentRowListItems(
            [cached],
            articles,
            homeInsuranceArticleId
          ),
        },
        metadata
      )
    }
  )

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
          { leaseId: createLeaseTenfastResult.data },
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
   *         description: Lease not found (error lease-not-found).
   *       409:
   *         description: The ended home insurance rent row this add replaces was changed by someone else at the same time (error home-insurance-row-changed).
   *       422:
   *         description: The current home insurance rent row of the lease has no end date (error home-insurance-already-exists).
   *       503:
   *         description: Tenfast could not be read or written (error upstream-failed).
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
        sendHomeInsuranceError(
          ctx,
          homeInsuranceLeaseReadError(getCurrentLease.err),
          metadata
        )
        return
      }

      const articleId = config.tenfast.leaseRentRows.homeInsurance.articleId

      // Any open-ended row, or a row still to start, already insures the
      // lease, even when the row in force today has an end date.
      if (
        hasOpenOrUpcomingHomeInsuranceRow(getCurrentLease.data.hyror, articleId)
      ) {
        sendHomeInsuranceError(
          ctx,
          { status: 422, error: 'home-insurance-already-exists' },
          metadata
        )
        return
      }

      const existingHomeInsurance = selectCurrentHomeInsuranceRow(
        getCurrentLease.data.hyror,
        articleId
      )
      const removedRowIds = existingHomeInsurance
        ? [existingHomeInsurance._id]
        : []
      const written: HomeInsuranceReplacementRow = {
        amount: ctx.request.body.monthlyAmount,
        article: articleId,
        label: 'Hemförsäkring',
        vat: 0, // No VAT on insurance
        from: toYearMonthDayString(ctx.request.body.from),
      }

      const updateHomeInsuranceResult = await writeHomeInsuranceRows({
        leaseId: ctx.params.leaseId,
        rowsToDelete: removedRowIds,
        rowsToAdd: [written],
      })

      if (!updateHomeInsuranceResult.ok) {
        sendHomeInsuranceError(
          ctx,
          homeInsuranceRowsWriteError(updateHomeInsuranceResult.err),
          metadata
        )
        return
      }

      logMinaSidorHomeInsuranceReadBack(
        await readBackHomeInsuranceWrite({
          leaseId: ctx.params.leaseId,
          rowsBefore: getCurrentLease.data.hyror,
          removedRowIds,
          written,
        }),
        { leaseId: ctx.params.leaseId, route: 'add' }
      )

      ctx.status = 201
      ctx.body = makeSuccessResponseBody(null, metadata)
    }
  )

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   get:
   *     summary: Get home insurance for a lease
   *     description: >
   *       Returns the lease's current home insurance rent row: the row in
   *       force today, else the next one to start, else the one that ended
   *       last. rowId identifies the row for PATCH
   *       /leases/{leaseId}/home-insurance/rows/{rowId}.
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     rowId:
   *                       type: string
   *                     monthlyAmount:
   *                       type: number
   *                     from:
   *                       type: string
   *                       format: date
   *                     to:
   *                       type: string
   *                       format: date
   *       404:
   *         description: Lease not found (error lease-not-found), or the lease has no home insurance rent row (error home-insurance-row-not-found).
   *       503:
   *         description: Tenfast could not be read (error upstream-failed).
   */
  router.get('(.*)/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const getCurrentLease = await tenfastAdapter.getLeaseByExternalId(
      ctx.params.leaseId
    )

    if (!getCurrentLease.ok) {
      sendHomeInsuranceError(
        ctx,
        homeInsuranceLeaseReadError(getCurrentLease.err),
        metadata
      )
      return
    }

    const homeInsuranceRow = selectCurrentHomeInsuranceRow(
      getCurrentLease.data.hyror,
      config.tenfast.leaseRentRows.homeInsurance.articleId
    )

    if (!homeInsuranceRow) {
      sendHomeInsuranceError(
        ctx,
        { status: 404, error: 'home-insurance-row-not-found' },
        metadata
      )
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody<leasing.HomeInsuranceRow>(
      toHomeInsuranceRow(homeInsuranceRow),
      metadata
    )
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance/cancel:
   *   post:
   *     summary: Cancel lease home insurance
   *     description: >
   *       Ends the lease's home insurance on endDate. The rent row in force on
   *       endDate is replaced with a copy that has that last day, and rows
   *       that would start after it are removed. Without a row in force on
   *       endDate, the first row to start after it is ended on its own first
   *       day, so the lease always keeps one row. After the write the lease is
   *       read again, and rows that differ from what the write meant are
   *       logged. Called from Mina sidor, which needs 200 on every successful
   *       write.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: leaseId
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
   *                 description: The last day the home insurance is in force.
   *     responses:
   *       200:
   *         description: The home insurance rent row now ends on endDate, or on its first day if endDate is before it. content is null.
   *       400:
   *         description: The request body is invalid.
   *       404:
   *         description: Lease not found (error lease-not-found), or the lease has no home insurance rent row (error home-insurance-row-not-found).
   *       409:
   *         description: A row to end or remove was changed by someone else at the same time (error home-insurance-row-changed). Nothing was written; try again.
   *       503:
   *         description: Tenfast could not be read or written (error upstream-failed).
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
        sendHomeInsuranceError(
          ctx,
          homeInsuranceLeaseReadError(lease.err),
          metadata
        )
        return
      }

      // The row in force on endDate ends on it, never before its first
      // day, and rows that would start after it are removed. One row is
      // always kept: Mina sidor shows a lease to come without a home
      // insurance row as insured. Days are compared as yyyy-mm-dd strings.
      const plan = planHomeInsuranceCancel(
        lease.data.hyror,
        config.tenfast.leaseRentRows.homeInsurance.articleId,
        toYearMonthDayString(ctx.request.body.endDate)
      )

      if (!plan) {
        sendHomeInsuranceError(
          ctx,
          { status: 404, error: 'home-insurance-row-not-found' },
          metadata
        )
        return
      }

      const replaceLeaseInvoiceRow = await writeHomeInsuranceRows({
        leaseId: ctx.params.leaseId,
        rowsToDelete: plan.rowsToDelete,
        rowsToAdd: [plan.written],
      })

      if (!replaceLeaseInvoiceRow.ok) {
        sendHomeInsuranceError(
          ctx,
          homeInsuranceRowsWriteError(replaceLeaseInvoiceRow.err),
          metadata
        )
        return
      }

      logMinaSidorHomeInsuranceReadBack(
        await readBackHomeInsuranceWrite({
          leaseId: ctx.params.leaseId,
          rowsBefore: lease.data.hyror,
          removedRowIds: plan.rowsToDelete,
          written: plan.written,
        }),
        { leaseId: ctx.params.leaseId, route: 'cancel' }
      )

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(null, metadata)
    }
  )

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance/rows/{rowId}:
   *   patch:
   *     summary: End a home insurance rent row
   *     description: >
   *       For staff. Ends the given home insurance rent row on endDate.
   *       action cancel removes the row when endDate is on or before its first
   *       day, and otherwise ends it on endDate. action set-end ends it on
   *       endDate, which may not be before its first day. Ending a row
   *       replaces it with a new row with a new rowId. If the row has been
   *       changed by someone else, Tenfast refuses the write and the answer
   *       is 409 with nothing written. After the write the lease is read
   *       again: the old row must be gone and the home insurance rows must be
   *       exactly the ones before plus the written row, or the answer is 409
   *       (someone else changed the rows at the same time) or 503 (the lease
   *       could not be read again).
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *       - in: path
   *         name: rowId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rowId of the home insurance rent row, as last read.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - endDate
   *               - action
   *             properties:
   *               endDate:
   *                 type: string
   *                 format: date
   *                 description: The last day the home insurance is in force, as yyyy-mm-dd.
   *               action:
   *                 type: string
   *                 enum: [cancel, set-end]
   *     responses:
   *       200:
   *         description: The row was removed (action deleted, row null) or ended (action ended, row is the new row).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     action:
   *                       type: string
   *                       enum: [deleted, ended]
   *                     row:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         rowId:
   *                           type: string
   *                         monthlyAmount:
   *                           type: number
   *                         from:
   *                           type: string
   *                           format: date
   *                         to:
   *                           type: string
   *                           format: date
   *       400:
   *         description: >
   *           The request body is invalid, endDate is before the row's first
   *           day with action set-end (error end-date-before-start), or the row
   *           already ends on endDate (error end-date-unchanged).
   *       404:
   *         description: Lease not found (error lease-not-found), or the lease has no home insurance rent row (error home-insurance-row-not-found).
   *       409:
   *         description: >
   *           The lease has home insurance rent rows but none with this rowId,
   *           the row was changed by someone else before the write (nothing
   *           written), or the rows were changed by someone else during it
   *           (error home-insurance-row-changed). Read the row again.
   *       503:
   *         description: Tenfast could not be read or written, or the lease could not be read again after the write (error upstream-failed).
   */
  router.patch(
    '(.*)/leases/:leaseId/home-insurance/rows/:rowId',
    parseRequestBody(leasing.UpdateHomeInsuranceRowRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { leaseId, rowId } = ctx.params
      const { action } = ctx.request.body
      // Only brands the day: parseRequestBody has already checked that
      // endDate is a yyyy-mm-dd date, so this parse cannot throw.
      const endDate = YearMonthDayStringSchema.parse(ctx.request.body.endDate)
      const articleId = config.tenfast.leaseRentRows.homeInsurance.articleId

      const lease = await tenfastAdapter.getLeaseByExternalId(leaseId)
      if (!lease.ok) {
        sendHomeInsuranceError(
          ctx,
          homeInsuranceLeaseReadError(lease.err),
          metadata
        )
        return
      }

      const homeInsuranceRows = lease.data.hyror.filter(
        (row) => row.article === articleId
      )
      if (homeInsuranceRows.length === 0) {
        sendHomeInsuranceError(
          ctx,
          { status: 404, error: 'home-insurance-row-not-found' },
          metadata
        )
        return
      }

      const row = homeInsuranceRows.find((candidate) => candidate._id === rowId)
      if (!row) {
        sendHomeInsuranceError(
          ctx,
          { status: 409, error: 'home-insurance-row-changed' },
          metadata
        )
        return
      }

      const plan = planHomeInsuranceEnd(row, endDate, action)
      if (plan.kind === 'error') {
        sendHomeInsuranceError(
          ctx,
          { status: 400, error: plan.error },
          metadata
        )
        return
      }

      const written = plan.kind === 'replace' ? plan.row : null
      const write = await writeHomeInsuranceRows({
        leaseId,
        rowsToDelete: [row._id],
        rowsToAdd: written ? [written] : [],
      })
      if (!write.ok) {
        sendHomeInsuranceError(
          ctx,
          homeInsuranceRowsWriteError(write.err),
          metadata
        )
        return
      }

      // The write decides, not a check before it: read the lease again and
      // make sure the rows are what this write meant to leave.
      const readBack = await readBackHomeInsuranceWrite({
        leaseId,
        rowsBefore: lease.data.hyror,
        removedRowIds: [row._id],
        written,
      })
      if (!readBack.ok) {
        logger.error(
          { leaseId, rowId, action, error: readBack.err },
          'PATCH home-insurance row: written, but the lease could not be read again to check the write'
        )
        sendHomeInsuranceError(
          ctx,
          { status: 503, error: 'upstream-failed' },
          metadata
        )
        return
      }

      const check = readBack.check
      if (!check.ok) {
        // The write has gone through, but someone else changed the rows at
        // the same time, such as by adding a row. A second write on this row
        // cannot cause it: Tenfast refuses that one. addedRowIds names the
        // rows to look at.
        logger.error(
          {
            leaseId,
            rowId,
            action,
            reason: check.reason,
            addedRowIds: check.addedRowIds,
          },
          'PATCH home-insurance row: the rows after the write are not what it meant to leave, check the lease'
        )
        sendHomeInsuranceError(
          ctx,
          { status: 409, error: 'home-insurance-row-changed' },
          metadata
        )
        return
      }

      const body: leasing.UpdateHomeInsuranceRowResponse = check.row
        ? { action: 'ended', row: toHomeInsuranceRow(check.row) }
        : { action: 'deleted', row: null }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(body, metadata)
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
