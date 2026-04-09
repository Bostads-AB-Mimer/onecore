import { Context } from 'koa'
import { Lease, leasing } from '@onecore/types'
import {
  PaginatedResponse,
  buildPaginationLinks,
  logger,
} from '@onecore/utilities'

import { TenfastLease } from './schemas'
import * as tenfastApi from './tenfast-api'
import { TenfastLeaseSchema } from './schemas'
import config from '../../../../common/config'
import { AdapterResult } from '../types'
import { mapToOnecoreLease } from '../../helpers/tenfast'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

/**
 * Uses the Tenfast search endpoint: GET /v1/hyresvard/avtal/search
 *
 * Supported filters (deepObject style, must use actual field paths):
 * filter[isArchived], filter[startDate], filter[endDate], filter[stage],
 * filter[externalId], filter[hyresgaster][displayName], filter[hyresgaster][idbeteckning],
 * filter[hyresgaster][externalId], filter[hyresobjekt][typ], filter[hyresobjekt][stadsdel],
 * filter[hyresobjekt][postadress], filter[hyresobjekt][fastighet][fastighetsbeteckning]
 *
 * Invalid filter parameters will cause an error (fail-early).
 * Pagination: cursor-based via `limit` + `paginate` (cursor token from prev response).
 */

const OBJECT_TYPE_TO_TENFAST_TYP: Record<string, string> = {
  bostad: 'bostad',
  parkering: 'parkering',
  lokal: 'lokal',
  ovrigt: 'ovrigt',
  forrad: 'forrad',
}

const STATUS_TO_TENFAST_STAGE: Record<string, string> = {
  current: 'active',
  active: 'active',
  upcoming: 'upcoming',
  abouttoend: 'terminationScheduled',
  ended: 'terminated',
  pendingsignature: 'signingInProgress',
  preliminaryterminated: 'preTermination',
  notsent: 'draft',
}

/**
 * Analyze free-text `q` and return matching Tenfast API filters.
 * Matches contact codes, personnummer and lease IDs.
 * Returns empty for names/addresses — use explicit `name`/`address` params instead.
 */
export function analyzeSearchTermForApi(q: string): Array<{
  filterKey: string
  filterValue: string
}> {
  const trimmed = q.trim()
  if (!trimmed) return []

  // Contact code: starts with P,F,I,K,L,Ö,S followed by digits
  if (/^[PFIKLÖS pfiklös]\d+$/.test(trimmed)) {
    return [
      {
        filterKey: 'filter[hyresgaster][externalId]',
        filterValue: trimmed.toUpperCase(),
      },
    ]
  }

  // Personnummer or digit string
  const digitsOnly = trimmed.replace(/[\s-]/g, '')
  if (/^\d+$/.test(digitsOnly)) {
    return [
      {
        filterKey: 'filter[hyresgaster][idbeteckning]',
        filterValue: trimmed,
      },
    ]
  }

  // Lease ID pattern: contains / (e.g. 206-706-00-0005/04)
  if (trimmed.includes('/')) {
    return [{ filterKey: 'filter[externalId]', filterValue: trimmed }]
  }

  return []
}

export function buildTenfastQueryParams(
  params: leasing.v1.LeaseSearchQueryParams
): URLSearchParams {
  const query = new URLSearchParams()

  query.set('populate', 'hyresgaster,hyresobjekt')
  query.set('filter[isArchived]', 'false')

  if (params.q) {
    const apiFilters = analyzeSearchTermForApi(params.q)
    for (const filter of apiFilters) {
      query.set(filter.filterKey, filter.filterValue)
    }
  }

  if (params.name) {
    query.set('filter[hyresgaster][displayName]', params.name)
  }

  if (params.address) {
    query.set('filter[hyresobjekt][postadress]', params.address.trim())
  }

  if (params.startDateFrom || params.startDateTo) {
    const from = params.startDateFrom ?? ''
    const to = params.startDateTo ?? ''
    query.set('filter[startDate]', `${from},${to}`)
  }
  if (params.endDateFrom || params.endDateTo) {
    const from = params.endDateFrom ?? ''
    const to = params.endDateTo ?? ''
    query.set('filter[endDate]', `${from},${to}`)
  }

  if (params.objectType && params.objectType.length > 0) {
    const tenfastTypes = params.objectType
      .map((t) => OBJECT_TYPE_TO_TENFAST_TYP[t.toLowerCase()])
      .filter(Boolean)
    if (tenfastTypes.length > 0) {
      query.set('filter[hyresobjekt][typ]', tenfastTypes.join(','))
    }
  }

  if (params.status && params.status.length > 0) {
    const tenfastStages = params.status
      .map((s) => STATUS_TO_TENFAST_STAGE[s.toLowerCase()])
      .filter(Boolean)
    if (tenfastStages.length > 0) {
      query.set('filter[stage]', tenfastStages.join(','))
    }
  }

  if (params.property && params.property.length > 0) {
    query.set(
      'filter[hyresobjekt][fastighet][fastighetsbeteckning]',
      params.property.join(',')
    )
  }

  if (params.districtNames && params.districtNames.length > 0) {
    query.set('filter[hyresobjekt][stadsdel]', params.districtNames.join(','))
  }

  const limit = params.limit ?? 20
  query.set('limit', String(limit))

  return query
}

export async function fetchLeases(
  params: leasing.v1.LeaseSearchQueryParams
): Promise<
  AdapterResult<
    { leases: TenfastLease[]; totalCount: number },
    'unknown' | 'could-not-parse-leases'
  >
> {
  try {
    const queryParams = buildTenfastQueryParams(params)
    // Tenfast API expects literal brackets and commas, not URL-encoded
    const queryString = queryParams
      .toString()
      .replace(/%5B/gi, '[')
      .replace(/%5D/gi, ']')
      .replace(/%2C/gi, ',')
    const url = `${tenfastBaseUrl}/v1/hyresvard/avtal/search?hyresvard=${tenfastCompanyId}&${queryString}`

    const res = await tenfastApi.request({
      method: 'get',
      url,
    })

    if (res.status !== 200) {
      logger.error(
        { status: res.status, data: res.data },
        'tenfast-lease-search-adapter.fetchLeases: Failed to fetch leases'
      )
      return { ok: false, err: 'unknown' }
    }

    // Tenfast wraps results in { records: [...], prev, next, totalCount }
    const isWrapped = !Array.isArray(res.data) && res.data?.records
    const records = isWrapped ? res.data.records : res.data
    const totalCount = isWrapped ? (res.data.totalCount ?? 0) : 0

    const parsed = TenfastLeaseSchema.array().safeParse(records)
    if (!parsed.success) {
      logger.error(
        { error: JSON.stringify(parsed.error, null, 2) },
        'tenfast-lease-search-adapter.fetchLeases: Failed to parse response'
      )
      return { ok: false, err: 'could-not-parse-leases' }
    }

    return {
      ok: true,
      data: {
        leases: parsed.data,
        totalCount: totalCount || parsed.data.length,
      },
    }
  } catch (err) {
    logger.error(
      { err },
      'tenfast-lease-search-adapter.fetchLeases: Unexpected error'
    )
    return { ok: false, err: 'unknown' }
  }
}

const applySorting = (
  results: Lease[],
  params: leasing.v1.LeaseSearchQueryParams
): Lease[] => {
  const sortBy = params.sortBy || 'leaseStartDate'
  const sortOrder = params.sortOrder || 'desc'
  const multiplier = sortOrder === 'asc' ? 1 : -1

  return [...results].sort((a, b) => {
    let aVal: Date | string | undefined
    let bVal: Date | string | undefined

    switch (sortBy) {
      case 'leaseStartDate':
        aVal = a.leaseStartDate
        bVal = b.leaseStartDate
        break
      case 'lastDebitDate':
        aVal = a.lastDebitDate
        bVal = b.lastDebitDate
        break
      case 'leaseId':
        aVal = a.leaseId
        bVal = b.leaseId
        break
      default:
        aVal = a.leaseStartDate
        bVal = b.leaseStartDate
    }

    // Handle undefined: push to end regardless of sort order
    if (aVal === undefined && bVal === undefined) return 0
    if (aVal === undefined) return 1
    if (bVal === undefined) return -1

    if (aVal instanceof Date && bVal instanceof Date) {
      return (aVal.getTime() - bVal.getTime()) * multiplier
    }

    return String(aVal).localeCompare(String(bVal)) * multiplier
  })
}

export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<Lease>> => {
  // Unrecognized q patterns return empty — use `name`/`address` params for text search
  if (params.q) {
    const filters = analyzeSearchTermForApi(params.q)
    if (filters.length === 0) {
      return {
        content: [],
        _meta: {
          totalRecords: 0,
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          count: 0,
        },
        _links: [],
      }
    }
  }

  const leasesResult = await fetchLeases(params)

  if (!leasesResult.ok) {
    throw new Error(`Failed to fetch leases from Tenfast: ${leasesResult.err}`)
  }

  const totalCount = leasesResult.data.totalCount

  const leases = leasesResult.data.leases.map(mapToOnecoreLease)
  const sortedResults = applySorting(leases, params)

  const page = params.page ?? 1
  const limit = params.limit ?? 20

  const totalRecords = totalCount || sortedResults.length

  const paginatedContent = sortedResults.slice(
    (page - 1) * limit,
    (page - 1) * limit + limit
  )

  const totalPages = Math.ceil(totalRecords / limit)

  return {
    content: paginatedContent,
    _meta: {
      totalRecords,
      page,
      limit,
      count: paginatedContent.length,
    },
    _links: buildPaginationLinks(ctx, page, limit, totalPages),
  }
}
