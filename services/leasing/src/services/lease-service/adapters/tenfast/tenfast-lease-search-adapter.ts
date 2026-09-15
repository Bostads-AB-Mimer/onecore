import { Context } from 'koa'
import { leasing, LeaseStatus, LeaseType } from '@onecore/types'
import {
  PaginatedResponse,
  buildPaginationLinks,
  logger,
} from '@onecore/utilities'

import { TenfastLease } from './schemas'
import * as tenfastAdapter from './tenfast-adapter'
import * as leaseCache from '../../../../common/lease-cache'
import {
  mapTenfastTypToLeaseType,
  calculateLeaseStatus,
} from '../../helpers/tenfast'
import {
  getRentalObjectCodesByBuildingManager,
  getRentalObjectCodesByKvvAreaCodes,
  getRentalObjectCodesByBuildingCodes,
  getRentalObjectCodesByAreaCodes,
  getRentalObjectCodesByDistrictNames,
} from '../xpand/lease-search-adapter'

/** Map Tenfast typ to Swedish label (matching Xpand's objectTypeCode output) */
const TENFAST_TYP_TO_LABEL: Record<string, string> = {
  bostad: 'Bostad',
  parkering: 'Parkering',
  lokal: 'Lokal',
  ovrigt: 'Övrigt',
  forrad: 'Förråd',
}

/** Build a LeaseSearchResult from a TenfastLease */
function mapTenfastLeaseToSearchResult(
  lease: TenfastLease
): leasing.v1.LeaseSearchResult {
  const ro = lease.hyresobjekt[0]
  const contacts: leasing.v1.ContactInfo[] = lease.hyresgaster.map((t) => ({
    name: t.displayName || `${t.name.first} ${t.name.last}`,
    contactCode: t.externalId,
    email: null,
    phone: null,
    contactType: 'tenant' as const,
  }))

  if (lease.andraHandHG?.externalId) {
    contacts.push({
      name: lease.andraHandHG.name ?? lease.andraHandHG.externalId,
      contactCode: lease.andraHandHG.externalId,
      email: lease.andraHandHG.email ?? null,
      phone: lease.andraHandHG.phone ?? null,
      contactType: 'subletTenant' as const,
    })
  }

  return {
    leaseId: lease.externalId,
    objectTypeCode: TENFAST_TYP_TO_LABEL[ro?.typ ?? ''] ?? ro?.typ ?? '',
    leaseType: mapTenfastTypToLeaseType(ro?.typ),
    contacts,
    address: ro?.postadress ?? null,
    rentalObjectCode: ro?.externalId ?? null,
    postalCode: null,
    city: null,
    property: ro?.fastighet?.fastighetsbeteckning ?? null,
    districtName: ro?.stadsdel ?? ro?.fastighet?.stadsdel ?? null,
    startDate: lease.startDate ?? null,
    lastDebitDate: lease.endDate ?? null,
    status: calculateLeaseStatus(lease),
  }
}

// UI param value → LeaseType enum values that match.
// 'ovrigt' is a catch-all for anything not bostad/parkering/lokal.
const KNOWN_NON_OVRIGT_TYPES = new Set([
  LeaseType.HousingContract,
  LeaseType.ParkingSpaceContract,
  LeaseType.CommercialTenantContract,
])

const OBJECT_TYPE_PARAM_TO_LEASE_TYPES: Record<string, LeaseType[]> = {
  bostad: [LeaseType.HousingContract],
  parkering: [LeaseType.ParkingSpaceContract],
  lokal: [LeaseType.CommercialTenantContract],
}

const STATUS_PARAM_TO_LEASE_STATUS: Record<string, LeaseStatus> = {
  current: LeaseStatus.Current,
  active: LeaseStatus.Current,
  upcoming: LeaseStatus.Upcoming,
  abouttoend: LeaseStatus.AboutToEnd,
  ended: LeaseStatus.Ended,
  pendingsignature: LeaseStatus.PendingSignature,
  preliminaryterminated: LeaseStatus.PreliminaryTerminated,
  notsent: LeaseStatus.NotSent,
}

export async function fetchAllLeasesForExport(
  params: leasing.v1.LeaseSearchQueryParams
): Promise<leasing.v1.LeaseSearchResult[]> {
  const needsXpandCodes =
    (params.buildingManager && params.buildingManager.length > 0) ||
    (params.buildingCodes && params.buildingCodes.length > 0) ||
    (params.areaCodes && params.areaCodes.length > 0) ||
    (params.districtNames && params.districtNames.length > 0) ||
    (params.kvvAreaCodes && params.kvvAreaCodes.length > 0)

  let rentalObjectCodes: Set<string> | undefined

  if (needsXpandCodes) {
    const codeSetPromises: Promise<string[]>[] = []

    if (params.buildingManager?.length)
      codeSetPromises.push(
        getRentalObjectCodesByBuildingManager(params.buildingManager)
      )
    if (params.buildingCodes?.length)
      codeSetPromises.push(
        getRentalObjectCodesByBuildingCodes(params.buildingCodes)
      )
    if (params.areaCodes?.length)
      codeSetPromises.push(getRentalObjectCodesByAreaCodes(params.areaCodes))
    if (params.districtNames?.length)
      codeSetPromises.push(
        getRentalObjectCodesByDistrictNames(params.districtNames)
      )
    if (params.kvvAreaCodes?.length)
      codeSetPromises.push(
        getRentalObjectCodesByKvvAreaCodes(params.kvvAreaCodes)
      )

    const codeSets = await Promise.all(codeSetPromises)

    let codes = codeSets[0]
    for (let i = 1; i < codeSets.length; i++) {
      const set = new Set(codeSets[i])
      codes = codes.filter((c) => set.has(c))
    }

    if (codes.length === 0) return []

    rentalObjectCodes = new Set(codes)
  }

  const filtered = applyCacheFilters(
    leaseCache.getAll(),
    params,
    rentalObjectCodes
  )
  const sorted = applySorting(filtered, params)

  logger.info(
    { totalInCache: leaseCache.getAll().length, afterFilters: sorted.length },
    'lease-cache: export served from cache'
  )

  return sorted
}

/**
 * Fetches all leases for the in-memory cache using full cursor pagination.
 * Uses getAllLeases() which follows the `next` cursor across all pages.
 */
export async function fetchAllLeasesForCache(): Promise<
  leasing.v1.LeaseSearchResult[]
> {
  const result = await tenfastAdapter.getAllLeases()
  if (!result.ok) {
    throw new Error(
      `fetchAllLeasesForCache: failed to fetch leases — ${result.err}`
    )
  }
  return result.data.map((l) => mapTenfastLeaseToSearchResult(l))
}

/**
 * Fetches only leases updated since `since` for delta cache refresh.
 * Uses a 30-second look-back buffer (applied by the caller) to guard against
 * clock skew between Tenfast and this service.
 */
export async function fetchLeasesUpdatedSinceForCache(
  since: Date
): Promise<leasing.v1.LeaseSearchResult[]> {
  const result = await tenfastAdapter.getLeasesUpdatedSince(since)
  if (!result.ok) {
    throw new Error(
      `fetchLeasesUpdatedSinceForCache: failed to fetch delta leases — ${result.err}`
    )
  }
  return result.data.map((l) => mapTenfastLeaseToSearchResult(l))
}

const applySorting = (
  results: leasing.v1.LeaseSearchResult[],
  params: leasing.v1.LeaseSearchQueryParams
): leasing.v1.LeaseSearchResult[] => {
  const sortBy = params.sortBy || 'leaseStartDate'
  const sortOrder = params.sortOrder || 'desc'
  const multiplier = sortOrder === 'asc' ? 1 : -1

  return [...results].sort((a, b) => {
    let aVal: Date | string | null | undefined
    let bVal: Date | string | null | undefined

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
      case 'objectType':
        aVal = a.objectTypeCode
        bVal = b.objectTypeCode
        break
      case 'address':
        aVal = a.address
        bVal = b.address
        break
      case 'rentalObjectCode':
        aVal = a.rentalObjectCode
        bVal = b.rentalObjectCode
        break
      case 'tenantName':
        aVal = a.contacts?.find((c) => c.contactType === 'tenant')?.name
        bVal = b.contacts?.find((c) => c.contactType === 'tenant')?.name
        break
      default:
        aVal = a.startDate
        bVal = b.startDate
    }

    // Handle null/undefined: push to end regardless of sort order
    if (
      (aVal === undefined || aVal === null) &&
      (bVal === undefined || bVal === null)
    )
      return 0
    if (aVal === undefined || aVal === null) return 1
    if (bVal === undefined || bVal === null) return -1

    if (aVal instanceof Date && bVal instanceof Date) {
      return (aVal.getTime() - bVal.getTime()) * multiplier
    }

    return String(aVal).localeCompare(String(bVal)) * multiplier
  })
}

/**
 * Filter all leases from the in-memory cache according to the given params.
 * `rentalObjectCodes` is pre-resolved from Xpand for Xpand-bridged filters
 * (buildingCodes, areaCodes, kvvAreaCodes, buildingManager); pass undefined
 * when none of those filters are active.
 */
function applyCacheFilters(
  leases: leasing.v1.LeaseSearchResult[],
  params: leasing.v1.LeaseSearchQueryParams,
  rentalObjectCodes?: Set<string>
): leasing.v1.LeaseSearchResult[] {
  return leases.filter((lease) => {
    if (
      rentalObjectCodes &&
      (!lease.rentalObjectCode ||
        !rentalObjectCodes.has(lease.rentalObjectCode))
    )
      return false

    if (params.status && params.status.length > 0) {
      const allowed = new Set(
        params.status
          .map((s) => STATUS_PARAM_TO_LEASE_STATUS[s.toLowerCase()])
          .filter((s): s is LeaseStatus => s !== undefined)
      )
      if (!allowed.has(lease.status)) return false
    }

    if (params.objectType && params.objectType.length > 0) {
      const paramTypes = params.objectType.map((t) => t.toLowerCase())
      const includesOvrigt = paramTypes.includes('ovrigt')
      const allowedTypes = new Set(
        paramTypes.flatMap((t) => OBJECT_TYPE_PARAM_TO_LEASE_TYPES[t] ?? [])
      )
      if (lease.leaseType === undefined) return false
      const matches =
        allowedTypes.has(lease.leaseType) ||
        (includesOvrigt && !KNOWN_NON_OVRIGT_TYPES.has(lease.leaseType))
      if (!matches) return false
    }

    if (params.q) {
      const q = params.q.toLowerCase().trim()
      const fields = [
        lease.leaseId,
        lease.rentalObjectCode ?? '',
        lease.address ?? '',
        ...(lease.contacts?.map((c) => c.contactCode) ?? []),
        ...(lease.contacts?.map((c) => c.name) ?? []),
      ]
      if (!fields.some((f) => f.toLowerCase().includes(q))) return false
    }

    if (params.name) {
      const name = params.name.toLowerCase().trim()
      if (!lease.contacts?.some((c) => c.name.toLowerCase().includes(name)))
        return false
    }

    if (params.address) {
      const addr = params.address.toLowerCase().trim()
      if (!(lease.address ?? '').toLowerCase().includes(addr)) return false
    }

    if (params.property && params.property.length > 0) {
      const propSet = new Set(params.property.map((p) => p.toLowerCase()))
      if (!lease.property || !propSet.has(lease.property.toLowerCase()))
        return false
    }

    if (params.startDateFrom && lease.startDate) {
      if (new Date(lease.startDate) < new Date(params.startDateFrom))
        return false
    }
    if (params.startDateTo && lease.startDate) {
      if (new Date(lease.startDate) > new Date(params.startDateTo)) return false
    }
    if (params.endDateFrom || params.endDateTo) {
      if (!lease.lastDebitDate) return false
      if (
        params.endDateFrom &&
        new Date(lease.lastDebitDate) < new Date(params.endDateFrom)
      )
        return false
      if (
        params.endDateTo &&
        new Date(lease.lastDebitDate) > new Date(params.endDateTo)
      )
        return false
    }

    return true
  })
}

async function searchLeasesFromCache(
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.max(1, params.limit ?? 20)

  // Xpand-bridged filters: resolve to rental object codes
  const needsXpandCodes =
    (params.buildingManager && params.buildingManager.length > 0) ||
    (params.buildingCodes && params.buildingCodes.length > 0) ||
    (params.areaCodes && params.areaCodes.length > 0) ||
    (params.districtNames && params.districtNames.length > 0) ||
    (params.kvvAreaCodes && params.kvvAreaCodes.length > 0)

  let rentalObjectCodes: Set<string> | undefined
  let xpandMs = 0

  if (needsXpandCodes) {
    const codeSetPromises: Promise<string[]>[] = []

    if (params.buildingManager?.length)
      codeSetPromises.push(
        getRentalObjectCodesByBuildingManager(params.buildingManager)
      )
    if (params.buildingCodes?.length)
      codeSetPromises.push(
        getRentalObjectCodesByBuildingCodes(params.buildingCodes)
      )
    if (params.areaCodes?.length)
      codeSetPromises.push(getRentalObjectCodesByAreaCodes(params.areaCodes))
    if (params.districtNames?.length)
      codeSetPromises.push(
        getRentalObjectCodesByDistrictNames(params.districtNames)
      )
    if (params.kvvAreaCodes?.length)
      codeSetPromises.push(
        getRentalObjectCodesByKvvAreaCodes(params.kvvAreaCodes)
      )

    const xpandStart = Date.now()
    const codeSets = await Promise.all(codeSetPromises)
    xpandMs = Date.now() - xpandStart

    let codes = codeSets[0]
    for (let i = 1; i < codeSets.length; i++) {
      const set = new Set(codeSets[i])
      codes = codes.filter((c) => set.has(c))
    }

    if (codes.length === 0) {
      logger.info(
        { xpandMs },
        'lease-cache: xpand filter returned no codes, skipping cache search'
      )
      return {
        content: [],
        _meta: { totalRecords: 0, page, limit, count: 0 },
        _links: [],
      }
    }

    rentalObjectCodes = new Set(codes)
  }

  const filterStart = Date.now()
  const filtered = applyCacheFilters(
    leaseCache.getAll(),
    params,
    rentalObjectCodes
  )
  const sorted = applySorting(filtered, params)
  const filterMs = Date.now() - filterStart

  const totalCount = sorted.length
  const totalPages = Math.ceil(totalCount / limit)
  const pageSlice = sorted.slice((page - 1) * limit, page * limit)

  logger.info(
    {
      totalInCache: leaseCache.getAll().length,
      afterFilters: totalCount,
      page,
      xpandMs,
      filterMs,
    },
    'lease-cache: search served from cache'
  )

  return {
    content: pageSlice,
    _meta: { totalRecords: totalCount, page, limit, count: pageSlice.length },
    _links: buildPaginationLinks(ctx, page, limit, totalPages),
  }
}

export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const requestStart = Date.now()
  const STALE_THRESHOLD_MS = 60_000
  const STALE_SYNC_TIMEOUT_MS = 10_000

  if (leaseCache.getAll().length === 0) {
    // Initial sync in progress or failed — no data to serve yet
    ctx.throw(503, 'Lease cache is warming up — retry shortly', {
      headers: { 'Retry-After': '30' },
    })
  }

  // Cache has data — if stale, await a delta sync before responding.
  // Timeout falls back to existing data so the request never hangs indefinitely.
  await leaseCache.refreshIfStale(STALE_THRESHOLD_MS, STALE_SYNC_TIMEOUT_MS)

  const result = await searchLeasesFromCache(params, ctx)
  logger.info(
    { totalMs: Date.now() - requestStart },
    'lease-cache: searchLeases complete'
  )
  return result
}
