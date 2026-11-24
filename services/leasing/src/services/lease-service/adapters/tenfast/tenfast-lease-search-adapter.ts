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
import * as xpandEndedLeaseCache from '../../../../common/xpand-ended-lease-cache'
import { mergeTenfastFirst } from '../../helpers/merge-tenfast-first'
import type { DeltaSyncResult } from '../../../../common/lease-cache'
import {
  mapTenfastTypToLeaseType,
  calculateLeaseStatus,
  buildTenfastLeaseUrl,
  getLeaseEndDate,
  deriveTenfastLeaseType,
  normaliseRentalObjectCode,
  GARAGE_PARKING_SPACE_TYPE_CODES,
} from '../../helpers/tenfast'
import {
  getRentalObjectCodesByBuildingManager,
  getRentalObjectCodesByKvvAreaCodes,
  getRentalObjectCodesByBuildingCodes,
  getRentalObjectCodesByAreaCodes,
  getRentalObjectCodesByDistrictNames,
  getParkingSpaceTypesByRentalObjectCode,
} from '../xpand/lease-search-adapter'

const STALE_THRESHOLD_MS = 60_000
const STALE_SYNC_TIMEOUT_MS = 10_000

/** Map Tenfast typ to Swedish label (matching Xpand's objectTypeCode output) */
const TENFAST_TYP_TO_LABEL: Record<string, string> = {
  bostad: 'Bostad',
  parkering: 'Parkering',
  lokal: 'Lokal',
  ovrigt: 'Övrigt',
  // Xpand types förråd as a lokal (keycmobt 'balok'), so it is labelled and
  // filtered as Lokal there.
  förråd: 'Lokal',
  forrad: 'Lokal',
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

  const endDate = getLeaseEndDate(lease) ?? null

  return {
    leaseId: lease.externalId,
    externalUrl: buildTenfastLeaseUrl(lease._id),
    objectTypeCode:
      TENFAST_TYP_TO_LABEL[ro?.typ?.toLowerCase() ?? ''] ?? ro?.typ ?? '',
    leaseType: mapTenfastTypToLeaseType(ro?.typ),
    contacts,
    address: ro?.postadress ?? null,
    rentalObjectCode: ro?.externalId ?? null,
    postalCode: null,
    city: null,
    property: ro?.fastighet?.fastighetsbeteckning ?? null,
    districtName: ro?.stadsdel ?? ro?.fastighet?.stadsdel ?? null,
    startDate: lease.startDate ?? null,
    endDate,
    lastDebitDate: endDate,
    signedAt: lease.signedAt ?? null,
    status: calculateLeaseStatus(lease),
  }
}

// objectTypeCode label → UI objectType param; any other label counts as 'ovrigt'.
const OBJECT_TYPE_LABEL_TO_PARAM: Record<string, string> = {
  Bostad: 'bostad',
  Parkering: 'parkering',
  Lokal: 'lokal',
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

/**
 * Resolves Xpand-bridged filters (buildingManager, buildingCodes, areaCodes,
 * districtNames, kvvAreaCodes) to the set of matching rental object codes.
 * Returns null when none of those filters are present, meaning the cache
 * search shouldn't be restricted by rental object code at all.
 */
async function resolveXpandRentalObjectCodes(
  params: leasing.v1.LeaseSearchQueryParams
): Promise<Set<string> | null> {
  const needsXpandCodes =
    (params.buildingManager && params.buildingManager.length > 0) ||
    (params.buildingCodes && params.buildingCodes.length > 0) ||
    (params.areaCodes && params.areaCodes.length > 0) ||
    (params.districtNames && params.districtNames.length > 0) ||
    (params.kvvAreaCodes && params.kvvAreaCodes.length > 0)

  if (!needsXpandCodes) return null

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

  return new Set(codes)
}

/**
 * Resolves the parkingSpaceType filter to the set of rental object codes
 * that have one of the chosen types. Returns null when the filter is absent
 * (don't restrict by type), and an empty set when it is present but matches
 * no parking space — those are different outcomes, so callers must check
 * `!== undefined`/`!== null` rather than truthiness.
 *
 * Kept separate from resolveXpandRentalObjectCodes: that set is AND-ed
 * across every Xpand-bridged filter, so merging the two would make
 * Bostad + a parking-space type return nothing.
 */
async function resolveParkingSpaceObjectCodes(
  params: leasing.v1.LeaseSearchQueryParams
): Promise<Set<string> | null> {
  if (!params.parkingSpaceType || params.parkingSpaceType.length === 0) {
    return null
  }

  const typesByCode = await getParkingSpaceTypesByRentalObjectCode(
    params.parkingSpaceType
  )
  return new Set(typesByCode.keys())
}

const normaliseLeaseType = (leaseType: string): string =>
  leaseType.trim().toLowerCase()

// The two contract types only the garage lookup can tell apart.
const PARKING_LEASE_TYPES = new Set(
  [LeaseType.GarageContract, LeaseType.ParkingSpaceContract].map(
    normaliseLeaseType
  )
)

// leaseType filter value a row matches; any other type counts as Övrigt,
// the way an unknown objectTypeCode counts as 'ovrigt'. Campuskontrakt,
// Korttidsuthyrning and the like only exist on leases that ended in Xpand.
const LEASE_TYPES_WITH_OWN_FILTER = new Set(
  [
    LeaseType.HousingContract,
    LeaseType.CommercialTenantContract,
    LeaseType.GarageContract,
    LeaseType.ParkingSpaceContract,
  ].map(normaliseLeaseType)
)

const leaseTypeFilterValue = (leaseType: LeaseType): string => {
  const normalised = normaliseLeaseType(leaseType)
  return LEASE_TYPES_WITH_OWN_FILTER.has(normalised)
    ? normalised
    : normaliseLeaseType(LeaseType.OtherContract)
}

function leaseTypeFilterNeedsGarageCodes(
  params: leasing.v1.LeaseSearchQueryParams
): boolean {
  return (params.leaseType ?? []).some((t) =>
    PARKING_LEASE_TYPES.has(normaliseLeaseType(t))
  )
}

/**
 * Normalised rental object codes of the parking spaces whose type counts as
 * a garage. Rejects when Xpand can't be read — callers must not fall back to
 * "no garages", or every garage lease would pass as P-Platskontrakt.
 */
async function resolveGarageObjectCodes(): Promise<Set<string>> {
  const typesByCode = await getParkingSpaceTypesByRentalObjectCode(
    GARAGE_PARKING_SPACE_TYPE_CODES
  )
  const garageObjectCodes = new Set(
    [...typesByCode.keys()].map(normaliseRentalObjectCode)
  )
  // Mimer has garages, so none at all points at the data or the type codes.
  // Still answered as is: every parking lease is then P-Platskontrakt.
  if (garageObjectCodes.size === 0) {
    logger.warn(
      {
        garageSpaceCount: garageObjectCodes.size,
        typeCodes: GARAGE_PARKING_SPACE_TYPE_CODES,
      },
      'lease-search: no parking space has a garage type'
    )
  }
  return garageObjectCodes
}

function statusNamesEnded(params: leasing.v1.LeaseSearchQueryParams): boolean {
  return (params.status ?? []).some(
    (s) => STATUS_PARAM_TO_LEASE_STATUS[s.toLowerCase()] === LeaseStatus.Ended
  )
}

function wantsEnded(params: leasing.v1.LeaseSearchQueryParams): boolean {
  return params.includeEnded === true || statusNamesEnded(params)
}

// Both caches swap in a new array on every sync, so array identity marks a change.
let mergedPool: {
  tenfastRows: leasing.v1.LeaseSearchResult[]
  xpandRows: leasing.v1.LeaseSearchResult[]
  rows: leasing.v1.LeaseSearchResult[]
  // Built on first use, by the contract-type derivation only.
  xpandRowSet?: Set<leasing.v1.LeaseSearchResult>
} | null = null

type SearchPool = {
  rows: leasing.v1.LeaseSearchResult[]
  // Rows from the ended Xpand cache keep the contract type Xpand gave them;
  // only Tenfast rows get a derived one. Told apart by object identity, as
  // the merged pool holds the cached row objects themselves.
  isEndedXpandRow: (row: leasing.v1.LeaseSearchResult) => boolean
}

const tenfastOnly = (rows: leasing.v1.LeaseSearchResult[]): SearchPool => ({
  rows,
  isEndedXpandRow: () => false,
})

function buildSearchPool(
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): SearchPool {
  const tenfastRows = leaseCache.getAll()
  if (!wantsEnded(params)) return tenfastOnly(tenfastRows)

  if (!xpandEndedLeaseCache.isReady()) {
    if (statusNamesEnded(params)) {
      ctx.throw(503, 'Ended Xpand leases are loading — retry shortly', {
        headers: { 'Retry-After': '30' },
      })
    }
    logger.warn('Ended Xpand leases not loaded, serving Tenfast rows only')
    return tenfastOnly(tenfastRows)
  }

  const xpandRows = xpandEndedLeaseCache.getAll()
  if (
    mergedPool?.tenfastRows !== tenfastRows ||
    mergedPool.xpandRows !== xpandRows
  ) {
    mergedPool = {
      tenfastRows,
      xpandRows,
      rows: mergeTenfastFirst(tenfastRows, xpandRows),
    }
  }
  const pool = mergedPool
  return {
    rows: pool.rows,
    isEndedXpandRow: (row) => {
      pool.xpandRowSet ??= new Set(pool.xpandRows)
      return pool.xpandRowSet.has(row)
    },
  }
}

export async function fetchAllLeasesForExport(
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<leasing.v1.LeaseSearchResult[]> {
  // Looked up once for every parking space, not once per row — the pool can
  // hold ~145,000 ended Xpand rows with Status "Upphört". If this lookup
  // fails, export without the type rather than failing the whole export:
  // the Objekttyp column falls back to "Parkering", which is not wrong.
  // Started first so it runs next to the other Xpand reads; the catch is
  // attached right away so it can't go unhandled if those throw first.
  const parkingSpaceTypesPromise: Promise<Map<string, string> | null> =
    getParkingSpaceTypesByRentalObjectCode().catch((err: unknown) => {
      logger.error(
        { err },
        'lease-cache: export: parking-space type lookup failed'
      )
      return null
    })

  // The Kontraktstyp column needs the garage codes on every export. If the
  // lookup fails the export fails with it, the same way a failed district
  // filter does, rather than write each garage lease as P-Platskontrakt.
  const garageObjectCodes = await resolveGarageObjectCodes()
  const { rows } = await findMatchingLeases(params, ctx, garageObjectCodes)

  logger.info(
    { totalInCache: leaseCache.getAll().length, afterFilters: rows.length },
    'lease-cache: export served from cache'
  )

  const parkingSpaceTypesByCode = await parkingSpaceTypesPromise
  if (!parkingSpaceTypesByCode) return rows

  return rows.map((row) => {
    const typeName = row.rentalObjectCode
      ? parkingSpaceTypesByCode.get(row.rentalObjectCode)
      : undefined
    return typeName ? { ...row, parkingSpaceType: typeName } : row
  })
}

/**
 * The contacts on the leases a search with these params lists, one per
 * contact code. "Select all" on the lease list sends SMS and e-mail to these,
 * so they come from the same pool and filters as the list.
 */
export async function fetchContactsForLeaseSearch(
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<leasing.v1.ContactInfo[]> {
  const { rows: leases } = await findMatchingLeases(params, ctx)

  // Tenfast and Xpand rows are mixed here and JavaScript compares codes
  // exactly, so the same contact in another case or padding would get the
  // message twice.
  const contactsByCode = new Map<string, leasing.v1.ContactInfo>()
  for (const lease of leases) {
    for (const contact of lease.contacts ?? []) {
      const key = contact.contactCode.trim().toUpperCase()
      if (!contactsByCode.has(key)) contactsByCode.set(key, contact)
    }
  }

  logger.info(
    { leases: leases.length, contacts: contactsByCode.size },
    'lease-cache: contacts served from cache'
  )

  return [...contactsByCode.values()]
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
): Promise<DeltaSyncResult> {
  const result = await tenfastAdapter.getLeasesUpdatedSince(since)
  if (!result.ok) {
    throw new Error(
      `fetchLeasesUpdatedSinceForCache: failed to fetch delta leases — ${result.err}`
    )
  }

  // The list endpoint (unlike search) can't filter isArchived, so a lease
  // that got archived since the last sync comes back here rather than
  // being excluded like it would be from a full sync — remove it instead.
  const archived = result.data.filter((l) => l.stage === 'archived')
  const rest = result.data.filter((l) => l.stage !== 'archived')

  return {
    changed: rest.map((l) => mapTenfastLeaseToSearchResult(l)),
    removedLeaseIds: archived.map((l) => l.externalId),
  }
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
 * when none of those filters are active. `leaseTypeOf` gives the contract
 * type the leaseType filter matches on.
 */
function applyCacheFilters(
  leases: leasing.v1.LeaseSearchResult[],
  params: leasing.v1.LeaseSearchQueryParams,
  rentalObjectCodes: Set<string> | undefined,
  parkingSpaceObjectCodes: Set<string> | undefined,
  leaseTypeOf: (lease: leasing.v1.LeaseSearchResult) => LeaseType
): leasing.v1.LeaseSearchResult[] {
  const hasParkingSpaceTypeFilter = parkingSpaceObjectCodes !== undefined
  const allowedLeaseTypes =
    params.leaseType && params.leaseType.length > 0
      ? new Set(params.leaseType.map(normaliseLeaseType))
      : null

  return leases.filter((lease) => {
    if (
      rentalObjectCodes &&
      (!lease.rentalObjectCode ||
        !rentalObjectCodes.has(lease.rentalObjectCode))
    )
      return false

    if (
      allowedLeaseTypes &&
      !allowedLeaseTypes.has(leaseTypeFilterValue(leaseTypeOf(lease)))
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

    if (
      (params.objectType && params.objectType.length > 0) ||
      hasParkingSpaceTypeFilter
    ) {
      const rowType =
        OBJECT_TYPE_LABEL_TO_PARAM[lease.objectTypeCode] ?? 'ovrigt'

      // "Bilplats" and a parking-space type can't both be chosen in the UI,
      // but a stale saved link could still send both — a parking-space type
      // filter always replaces plain "parkering" matching.
      const objectTypeParams = (params.objectType ?? [])
        .map((t) => t.toLowerCase())
        .filter((t) => !hasParkingSpaceTypeFilter || t !== 'parkering')

      const matchesObjectType =
        objectTypeParams.length > 0 && objectTypeParams.includes(rowType)

      const matchesParkingSpaceType =
        hasParkingSpaceTypeFilter &&
        !!lease.rentalObjectCode &&
        parkingSpaceObjectCodes!.has(lease.rentalObjectCode)

      if (!matchesObjectType && !matchesParkingSpaceType) return false
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

const SORTED_MEMO_SIZE = 5

const sortedMemo: {
  pool: leasing.v1.LeaseSearchResult[]
  key: string
  rows: leasing.v1.LeaseSearchResult[]
}[] = []

function getFilteredSorted(
  pool: SearchPool,
  params: leasing.v1.LeaseSearchQueryParams,
  rentalObjectCodes: Set<string> | null,
  parkingSpaceObjectCodes: Set<string> | null,
  garageObjectCodes: Set<string> | null
): leasing.v1.LeaseSearchResult[] {
  const { page: _page, limit: _limit, ...rest } = params
  const key = JSON.stringify([
    rest,
    rentalObjectCodes ? [...rentalObjectCodes].sort() : null,
    parkingSpaceObjectCodes ? [...parkingSpaceObjectCodes].sort() : null,
    garageObjectCodes ? [...garageObjectCodes].sort() : null,
  ])
  const hit = sortedMemo.findIndex((m) => m.pool === pool.rows && m.key === key)
  if (hit >= 0) {
    const [entry] = sortedMemo.splice(hit, 1)
    sortedMemo.unshift(entry)
    return entry.rows
  }

  const leaseTypeOf = (lease: leasing.v1.LeaseSearchResult): LeaseType =>
    garageObjectCodes &&
    lease.leaseType === LeaseType.ParkingSpaceContract &&
    !pool.isEndedXpandRow(lease)
      ? deriveTenfastLeaseType(
          lease.leaseType,
          lease.rentalObjectCode,
          garageObjectCodes
        )
      : lease.leaseType

  const sorted = applySorting(
    applyCacheFilters(
      pool.rows,
      params,
      rentalObjectCodes ?? undefined,
      parkingSpaceObjectCodes ?? undefined,
      leaseTypeOf
    ),
    params
  )

  // The derived type goes on copies: the pool holds the cached rows.
  const rows = garageObjectCodes
    ? sorted.map((lease) => {
        const leaseType = leaseTypeOf(lease)
        return leaseType === lease.leaseType ? lease : { ...lease, leaseType }
      })
    : sorted

  sortedMemo.unshift({ pool: pool.rows, key, rows })
  sortedMemo.length = Math.min(sortedMemo.length, SORTED_MEMO_SIZE)
  return rows
}

/**
 * Every lease that matches the params, sorted, across all pages. The list,
 * the export and "select all" all read this one function, so they cannot
 * drift apart. The rows are shared with the results cache — do not mutate.
 *
 * Parking rows from Tenfast carry the derived contract type (Garagekontrakt
 * or P-Platskontrakt) only when the garage codes were looked up: when the
 * leaseType filter names one of those two, or when the caller passes
 * `garageObjectCodes` (the export). Any other search returns Tenfast parking
 * rows as P-Platskontrakt, skipping an Xpand query the result doesn't need.
 */
async function findMatchingLeases(
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context,
  garageObjectCodes?: Set<string>
): Promise<{
  rows: leasing.v1.LeaseSearchResult[]
  xpandMs: number
  filterMs: number
}> {
  if (leaseCache.getAll().length === 0) {
    const ready = await leaseCache.ensureReady(STALE_SYNC_TIMEOUT_MS)
    if (!ready) {
      ctx.throw(503, 'Lease cache is warming up — retry shortly', {
        headers: { 'Retry-After': '30' },
      })
    }
  }

  // Cache has data — if stale, await a delta sync before responding.
  // Timeout falls back to existing data so the request never hangs indefinitely.
  await leaseCache.refreshIfStale(STALE_THRESHOLD_MS, STALE_SYNC_TIMEOUT_MS)

  const pool = buildSearchPool(params, ctx)

  const xpandStart = Date.now()
  // A failed garage lookup rejects the search rather than matching no
  // garages: "select all" would otherwise message every other lease.
  const [rentalObjectCodes, parkingSpaceObjectCodes, garageCodes] =
    await Promise.all([
      resolveXpandRentalObjectCodes(params),
      resolveParkingSpaceObjectCodes(params),
      garageObjectCodes ??
        (leaseTypeFilterNeedsGarageCodes(params)
          ? resolveGarageObjectCodes()
          : null),
    ])
  const xpandMs = Date.now() - xpandStart

  // Only rentalObjectCodes can short-circuit here: it's AND-ed uniformly
  // over every row regardless of type, so an empty set really does mean no
  // lease can match. parkingSpaceObjectCodes instead unions with objectType
  // inside applyCacheFilters (Bostad + a type gives housing leases too), so
  // an empty set there must still flow through — short-circuiting on it
  // would turn "Bostad + a type that matches no parking space" into zero
  // results instead of every housing lease. applyCacheFilters already
  // handles an empty parkingSpaceObjectCodes set correctly on its own.
  // The same goes for an empty garageCodes set: it only reclassifies rows,
  // so Garagekontrakt + Bostadskontrakt still lists every housing lease.
  if (rentalObjectCodes && rentalObjectCodes.size === 0) {
    logger.info(
      { xpandMs },
      'lease-cache: xpand filter returned no codes, skipping cache search'
    )
    return { rows: [], xpandMs, filterMs: 0 }
  }

  const filterStart = Date.now()
  const rows = getFilteredSorted(
    pool,
    params,
    rentalObjectCodes,
    parkingSpaceObjectCodes,
    garageCodes
  )
  const filterMs = Date.now() - filterStart

  return { rows, xpandMs, filterMs }
}

export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const requestStart = Date.now()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.max(1, params.limit ?? 20)

  const { rows, xpandMs, filterMs } = await findMatchingLeases(params, ctx)

  const totalCount = rows.length
  const totalPages = Math.ceil(totalCount / limit)
  const pageSlice = rows.slice((page - 1) * limit, page * limit)

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
  logger.info(
    { totalMs: Date.now() - requestStart },
    'lease-cache: searchLeases complete'
  )

  return {
    content: pageSlice,
    _meta: { totalRecords: totalCount, page, limit, count: pageSlice.length },
    _links: buildPaginationLinks(ctx, page, limit, totalPages),
  }
}
