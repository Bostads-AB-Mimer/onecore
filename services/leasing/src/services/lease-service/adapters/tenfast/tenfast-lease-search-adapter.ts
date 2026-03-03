import { Context } from 'koa'
import { leasing, LeaseStatus } from '@onecore/types'
import {
  buildPaginatedResponse,
  PaginatedResponse,
  logger,
} from '@onecore/utilities'

import { TenfastLease } from './schemas'
import * as tenfastApi from './tenfast-api'
import { TenfastLeaseSchema } from './schemas'
import config from '../../../../common/config'
import { AdapterResult } from '../types'
import { calculateLeaseStatus } from '../../helpers/tenfast'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

/**
 * Build Tenfast API query parameters from search params.
 * Pushes as many filters as possible to the API to avoid fetching all leases.
 *
 * Supported Tenfast API filters (filter works on all Avtal schema fields):
 * - filter[isArchivedAt]=false  — exclude archived leases
 * - filter[startDate]=FROM,TO — date range (comma-separated)
 * - filter[endDate]=FROM,TO — date range (comma-separated)
 * - filter[hyresobjekt.typ]=bostad — object type filter
 * - filter[hyresobjekt][stadsdel]=Vetterstorp — district filter
 * - filter[fastighet][displayName]=name — property filter
 * - filter[stage]=requestedCancellation — lease stage filter
 * - filter[externalId]=206-706-00-0005/04 — lease ID filter
 * - filter[hyresgast][displayName]=name — tenant name filter
 * - filter[hyresgast][idBeteckning]=19870328 — personnummer filter
 * - filter[hyresgast][externalId]=P056822 — contact code filter
 * - filter[hyresobjekt][displayName]=Drever — rental object name/address filter
 * - limit=N / offset=N — pagination
 * - populate=hyresgaster,hyresobjekt — include related data
 */

/**
 * Maps our LeaseSearchQueryParams objectType values to Tenfast hyresobjekt.typ values.
 */
const OBJECT_TYPE_TO_TENFAST_TYP: Record<string, string> = {
  bostad: 'bostad',
  parkering: 'parkering',
  lokal: 'lokal',
  ovrigt: 'ovrigt',
  forrad: 'forrad',
}

/**
 * Maps our status filter values to Tenfast stage values where a direct mapping exists.
 * Some statuses (Current, Upcoming, Ended) require date comparison and cannot be
 * fully delegated to the API.
 */
const STATUS_TO_TENFAST_STAGE: Record<string, string> = {
  abouttoend: 'requestedCancellation',
  '2': 'requestedCancellation',
}

/**
 * Analyze a free-text search query and determine which Tenfast API filters to use.
 * Always returns one or more filters to push to the API.
 *
 * Patterns:
 * - Contact code (P/F/I/K/L/Ö/S + digits): filter[hyresgast][externalId]
 * - Personnummer (digits with optional dashes/spaces, ≥6 chars): filter[hyresgast][idBeteckning]
 * - Lease ID pattern (contains /): filter[externalId]
 * - Short digits (<6 chars): filter[hyresgast][idBeteckning]
 * - Letters or mixed: filter[hyresgast][displayName] + filter[hyresobjekt][displayName]
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
        filterKey: 'filter[hyresgast][externalId]',
        filterValue: trimmed.toUpperCase(),
      },
    ]
  }

  // Personnummer or digit string: all digits (possibly with dashes/spaces)
  const normalized = trimmed.replace(/[\s-]/g, '')
  if (/^\d+$/.test(normalized)) {
    return [
      {
        filterKey: 'filter[hyresgast][idBeteckning]',
        filterValue: normalized,
      },
    ]
  }

  // Lease ID pattern: contains / (e.g. 206-706-00-0005/04)
  if (trimmed.includes('/')) {
    return [{ filterKey: 'filter[externalId]', filterValue: trimmed }]
  }

  // Letters or mixed alphanumeric (name or address)
  return [
    { filterKey: 'filter[hyresgast][displayName]', filterValue: trimmed },
    { filterKey: 'filter[hyresobjekt][displayName]', filterValue: trimmed },
  ]
}

export function buildTenfastQueryParams(
  params: leasing.v1.LeaseSearchQueryParams
): URLSearchParams {
  const query = new URLSearchParams()

  query.set('populate', 'hyresgaster,hyresobjekt')
  query.set('filter[isArchivedAt]', 'false')

  // Free-text search — always pushed to API
  if (params.q) {
    const apiFilters = analyzeSearchTermForApi(params.q)
    for (const filter of apiFilters) {
      query.set(filter.filterKey, filter.filterValue)
    }
  }

  // Date filters — pushed to API using comma-separated range format
  // e.g. filter[startDate]=2026-02-01,2026-02-28
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

  // Object type filter — pushed to API via filter on the hyresobjekt typ field
  if (params.objectType && params.objectType.length === 1) {
    const tenfastTyp =
      OBJECT_TYPE_TO_TENFAST_TYP[params.objectType[0].toLowerCase()]
    if (tenfastTyp) {
      query.set('filter[hyresobjekt.typ]', tenfastTyp)
    }
  }

  // Stage filter — pushed to API when the status maps directly to a Tenfast stage
  if (params.status && params.status.length === 1) {
    const tenfastStage = STATUS_TO_TENFAST_STAGE[params.status[0].toLowerCase()]
    if (tenfastStage) {
      query.set('filter[stage]', tenfastStage)
    }
  }

  // Property filter — pushed to API via filter on fastighet displayName
  if (params.property && params.property.length === 1) {
    query.set('filter[fastighet][displayName]', params.property[0])
  }

  // District filter — pushed to API via filter on hyresobjekt stadsdel
  if (params.districtNames && params.districtNames.length === 1) {
    query.set('filter[hyresobjekt][stadsdel]', params.districtNames[0])
  }

  // When no client-side-only filters are active, let the API handle pagination
  const needsClientSideFiltering = needsClientSideProcessing(params)

  if (!needsClientSideFiltering) {
    const limit = params.limit ?? 20
    const page = params.page ?? 1
    const offset = (page - 1) * limit
    query.set('limit', String(limit))
    query.set('offset', String(offset))
  }

  return query
}

/**
 * Determines if the search params require client-side filtering/pagination.
 * Client-side processing is needed when:
 * - Multiple objectTypes are specified — API only supports single value
 * - Multiple properties or districts — API only supports single value
 * - Status filter requires date-based computation (current/upcoming/ended)
 */
function needsClientSideProcessing(
  params: leasing.v1.LeaseSearchQueryParams
): boolean {
  // Multiple object types require client-side filtering
  if (params.objectType && params.objectType.length > 1) return true

  // Multiple properties require client-side filtering
  if (params.property && params.property.length > 1) return true

  // Multiple districts require client-side filtering
  if (params.districtNames && params.districtNames.length > 1) return true

  // Status filter: only 'aboutToEnd' / '2' maps cleanly to a Tenfast stage.
  // All others (current, upcoming, ended) require date-based computation.
  if (params.status && params.status.length > 0) {
    const allMappable = params.status.every(
      (s) => STATUS_TO_TENFAST_STAGE[s.toLowerCase()] !== undefined
    )
    if (!allMappable) return true
  }

  return false
}

/**
 * Fetch leases from Tenfast with API-level filtering.
 * Uses GET /v1/hyresvard/avtal with filter[] query parameters.
 */
export async function fetchLeases(
  params: leasing.v1.LeaseSearchQueryParams
): Promise<
  AdapterResult<TenfastLease[], 'unknown' | 'could-not-parse-leases'>
> {
  try {
    const queryParams = buildTenfastQueryParams(params)
    const url = `${tenfastBaseUrl}/v1/hyresvard/avtal?hyresvard=${tenfastCompanyId}&${queryParams.toString()}`

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

    const parsed = TenfastLeaseSchema.array().safeParse(res.data)
    if (!parsed.success) {
      logger.error(
        { error: JSON.stringify(parsed.error, null, 2) },
        'tenfast-lease-search-adapter.fetchLeases: Failed to parse response'
      )
      return { ok: false, err: 'could-not-parse-leases' }
    }

    return { ok: true, data: parsed.data }
  } catch (err) {
    logger.error(
      { err },
      'tenfast-lease-search-adapter.fetchLeases: Unexpected error'
    )
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Determine object type label from TenfastLease rental object subType
 */
const getObjectTypeLabel = (lease: TenfastLease): string => {
  const rentalObject = lease.hyresobjekt[0]
  if (!rentalObject?.subType) return 'Okänd'

  const typeMap: Record<string, string> = {
    bostad: 'Bostad',
    parkering: 'Parkering',
    lokal: 'Lokal',
    ovrigt: 'Övrigt',
    forrad: 'Förråd',
  }

  return typeMap[rentalObject.subType.toLowerCase()] ?? rentalObject.subType
}

/**
 * Transform a TenfastLease into a LeaseSearchResult
 */
const transformToSearchResult = (
  lease: TenfastLease
): leasing.v1.LeaseSearchResult => {
  const rentalObject = lease.hyresobjekt[0]

  const contacts: leasing.v1.ContactInfo[] = lease.hyresgaster.map(
    (tenant) => ({
      name: tenant.displayName || `${tenant.name.first} ${tenant.name.last}`,
      contactCode: tenant.externalId,
      email: (tenant as any).email ?? (tenant as any).epost ?? null,
      phone: tenant.phone || null,
    })
  )

  return {
    leaseId: lease.externalId,
    objectTypeCode: getObjectTypeLabel(lease),
    leaseType: lease.method || 'Okänd',
    contacts,
    address: rentalObject?.postadress || null,
    startDate: lease.startDate,
    lastDebitDate: lease.endDate ?? null,
    status: calculateLeaseStatus(lease),
  }
}

/**
 * Status filter mapping from query param values to LeaseStatus
 */
const STATUS_MAP: Record<string, LeaseStatus> = {
  current: LeaseStatus.Current,
  upcoming: LeaseStatus.Upcoming,
  abouttoend: LeaseStatus.AboutToEnd,
  ended: LeaseStatus.Ended,
  '0': LeaseStatus.Current,
  '1': LeaseStatus.Upcoming,
  '2': LeaseStatus.AboutToEnd,
  '3': LeaseStatus.Ended,
}

/**
 * Apply client-side filters that cannot be (fully) pushed to the Tenfast API.
 * Filters are only applied client-side when the API couldn't handle them
 * (e.g. multiple values, unmappable patterns, etc.).
 */
const applyClientSideFilters = (
  leases: TenfastLease[],
  params: leasing.v1.LeaseSearchQueryParams
): TenfastLease[] => {
  let filtered = leases

  // Object type filter — only apply client-side when multiple types or no API mapping
  if (params.objectType && params.objectType.length > 0) {
    const wasPushedToApi =
      params.objectType.length === 1 &&
      OBJECT_TYPE_TO_TENFAST_TYP[params.objectType[0].toLowerCase()] !==
        undefined

    if (!wasPushedToApi) {
      const objectTypes = params.objectType.map((t) => t.toLowerCase())
      filtered = filtered.filter((l) => {
        const rentalObject = l.hyresobjekt[0]
        if (!rentalObject?.subType) return false
        return objectTypes.includes(rentalObject.subType.toLowerCase())
      })
    }
  }

  // Status filter — only apply client-side when it couldn't be fully pushed to API
  if (params.status && params.status.length > 0) {
    const allMappedToStage = params.status.every(
      (s) => STATUS_TO_TENFAST_STAGE[s.toLowerCase()] !== undefined
    )

    if (!allMappedToStage) {
      const targetStatuses = params.status
        .map((s) => STATUS_MAP[s.toLowerCase()])
        .filter((s) => s !== undefined)

      filtered = filtered.filter((l) => {
        const leaseStatus = calculateLeaseStatus(l)
        return targetStatuses.includes(leaseStatus)
      })
    }
  }

  return filtered
}

/**
 * Apply sorting to search results
 */
const applySorting = (
  results: leasing.v1.LeaseSearchResult[],
  params: leasing.v1.LeaseSearchQueryParams
): leasing.v1.LeaseSearchResult[] => {
  const sortBy = params.sortBy || 'leaseStartDate'
  const sortOrder = params.sortOrder || 'desc'
  const multiplier = sortOrder === 'asc' ? 1 : -1

  return [...results].sort((a, b) => {
    let aVal: Date | string | null
    let bVal: Date | string | null

    switch (sortBy) {
      case 'leaseStartDate':
        aVal = a.startDate
        bVal = b.startDate
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
        aVal = a.startDate
        bVal = b.startDate
    }

    // Handle nulls: push nulls to end regardless of sort order
    if (aVal === null && bVal === null) return 0
    if (aVal === null) return 1
    if (bVal === null) return -1

    if (aVal instanceof Date && bVal instanceof Date) {
      return (aVal.getTime() - bVal.getTime()) * multiplier
    }

    return String(aVal).localeCompare(String(bVal)) * multiplier
  })
}

/**
 * Main search function for Tenfast leases.
 *
 * Strategy:
 * - Pushes date filters and pagination to the Tenfast API via filter[] query params
 * - When no client-side-only filters are active (q, objectType, status), the API
 *   handles pagination directly (limit/offset)
 * - When client-side-only filters ARE active, all matching leases are fetched from
 *   the API and then filtered, sorted, and paginated in-memory
 */
export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const leasesResult = await fetchLeases(params)

  if (!leasesResult.ok) {
    throw new Error(`Failed to fetch leases from Tenfast: ${leasesResult.err}`)
  }

  // Apply client-side filters (q, objectType, status)
  const filteredLeases = applyClientSideFilters(leasesResult.data, params)

  // Transform to search results
  const searchResults = filteredLeases.map(transformToSearchResult)

  // Apply sorting
  const sortedResults = applySorting(searchResults, params)

  const page = params.page ?? 1
  const limit = params.limit ?? 20

  // If client-side filtering was needed, we must also paginate here
  const needsClientSidePagination = needsClientSideProcessing(params)

  const paginatedContent = needsClientSidePagination
    ? sortedResults.slice((page - 1) * limit, (page - 1) * limit + limit)
    : sortedResults

  return buildPaginatedResponse({
    content: paginatedContent,
    totalRecords: needsClientSidePagination
      ? sortedResults.length
      : paginatedContent.length,
    ctx,
    defaultLimit: limit,
  })
}
