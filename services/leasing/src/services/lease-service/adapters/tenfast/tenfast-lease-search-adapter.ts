import { Context } from 'koa'
import { Lease, leasing, LeaseStatus, LeaseType } from '@onecore/types'
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
import {
  mapTenfastTypToLeaseType,
  calculateLeaseStatus,
} from '../../helpers/tenfast'
import {
  getRentalObjectCodesByBuildingManager,
  getRentalObjectCodesByBuildingCodes,
  getRentalObjectCodesByAreaCodes,
  getRentalObjectCodesByDistrictNames,
} from '../xpand/lease-search-adapter'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

/**
 * Lightweight lease type for data from the batch-get endpoint.
 * The batch-get response shape differs from the search endpoint,
 * so we extract only the fields we need instead of using TenfastLeaseSchema.
 */
interface BatchGetTenant {
  externalId: string
  displayName: string
  name?: { first: string; last: string }
  idbeteckning: string
}

interface BatchGetRentalObject {
  externalId: string
  typ?: string
  postadress?: string
  stadsdel?: string
  fastighet?: { fastighetsbeteckning: string; stadsdel?: string }
  kvm?: number
}

interface BatchGetLease {
  externalId: string
  startDate: Date
  endDate?: Date
  stage: string
  signedAt?: Date
  uppsagningstid: string
  cancellation: {
    cancelled: boolean
    cancelledByType?: string
    handledAt?: Date
    preferredMoveOutDate?: Date
  }
  hyror: Array<{
    _id: string
    amount: number
    vat: number
    label: string
    article: string
    from?: string
    to?: string
  }>
  tenants: BatchGetTenant[]
  rentalObjects: BatchGetRentalObject[]
}

/** Map a batch-get lease to a onecore Lease */
function mapBatchGetLeaseToOnecoreLease(lease: BatchGetLease): Lease {
  const ro = lease.rentalObjects[0]
  const stadsdel = ro?.stadsdel ?? ro?.fastighet?.stadsdel

  const stageToStatus: Record<string, LeaseStatus> = {
    active: LeaseStatus.Current,
    upcoming: LeaseStatus.Upcoming,
    terminationScheduled: LeaseStatus.AboutToEnd,
    archived: LeaseStatus.Ended,
    terminated: LeaseStatus.Ended,
    signingInProgress: LeaseStatus.PendingSignature,
    preTermination: LeaseStatus.PreliminaryTerminated,
    draft: LeaseStatus.NotSent,
  }

  return {
    leaseId: lease.externalId,
    leaseNumber: lease.externalId.split('/')[1],
    leaseStartDate: lease.startDate,
    leaseEndDate: lease.endDate,
    status: stageToStatus[lease.stage] ?? LeaseStatus.Ended,
    noticeGivenBy: lease.cancellation.cancelledByType,
    noticeDate: lease.cancellation.handledAt,
    noticeTimeTenant: lease.uppsagningstid,
    preferredMoveOutDate: lease.cancellation.preferredMoveOutDate,
    terminationDate: lease.cancellation.handledAt,
    contractDate: lease.signedAt,
    lastDebitDate: lease.endDate,
    approvalDate: lease.signedAt,
    residentialArea: stadsdel
      ? { code: stadsdel, caption: stadsdel }
      : undefined,
    tenantContactIds: lease.tenants.map((t) => t.externalId),
    tenants: undefined,
    rentalPropertyId: ro?.externalId ?? 'missing',
    rentalObject: ro
      ? {
          rentalObjectCode: ro.externalId,
          address: ro.postadress ?? '',
          residentialAreaCaption: ro.stadsdel ?? '',
          residentialAreaCode: ro.stadsdel ?? '',
          objectTypeCaption: ro.typ ?? '',
          objectTypeCode: ro.typ ?? '',
          propertyCaption: ro.fastighet?.fastighetsbeteckning,
        }
      : undefined,
    type: mapTenfastTypToLeaseType(ro?.typ),
    rentRows: lease.hyror.map((r) => ({
      id: r._id,
      amount: r.amount,
      vat: r.vat,
      label: r.label,
      articleId: r.article,
      from: r.from as any,
      to: r.to as any,
    })),
  }
}

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
  }))

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

/** Build a LeaseSearchResult from a BatchGetLease */
function mapBatchGetLeaseToSearchResult(
  lease: BatchGetLease
): leasing.v1.LeaseSearchResult {
  const ro = lease.rentalObjects[0]
  const stageToStatus: Record<string, LeaseStatus> = {
    active: LeaseStatus.Current,
    upcoming: LeaseStatus.Upcoming,
    terminationScheduled: LeaseStatus.AboutToEnd,
    archived: LeaseStatus.Ended,
    terminated: LeaseStatus.Ended,
    signingInProgress: LeaseStatus.PendingSignature,
    preTermination: LeaseStatus.PreliminaryTerminated,
    draft: LeaseStatus.NotSent,
  }

  const contacts: leasing.v1.ContactInfo[] = lease.tenants.map((t) => ({
    name: t.displayName || (t.name ? `${t.name.first} ${t.name.last}` : ''),
    contactCode: t.externalId,
    email: null,
    phone: null,
  }))

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
    status: stageToStatus[lease.stage] ?? LeaseStatus.Ended,
  }
}

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
 * Apply all search/filter params locally on mapped leases.
 * Used when leases come from batch-get (building manager path) instead of
 * the search endpoint, since batch-get doesn't support query filters.
 */
function applyLocalFilters(
  leases: Lease[],
  batchLeases: BatchGetLease[],
  params: leasing.v1.LeaseSearchQueryParams
): Lease[] {
  const batchByLeaseId = new Map<string, BatchGetLease>()
  for (const bl of batchLeases) {
    batchByLeaseId.set(bl.externalId, bl)
  }

  return leases.filter((lease) => {
    const bl = batchByLeaseId.get(lease.leaseId)

    // Status filter
    if (params.status && params.status.length > 0) {
      const allowedStatuses = new Set(
        params.status
          .map((s) => STATUS_PARAM_TO_LEASE_STATUS[s.toLowerCase()])
          .filter((s) => s !== undefined)
      )
      if (!allowedStatuses.has(lease.status)) return false
    }

    // Object type filter
    if (params.objectType && params.objectType.length > 0) {
      const paramTypes = params.objectType.map((t) => t.toLowerCase())
      const includesOvrigt = paramTypes.includes('ovrigt')
      const allowedTypes = new Set(
        paramTypes.flatMap((t) => OBJECT_TYPE_PARAM_TO_LEASE_TYPES[t] ?? [])
      )

      const leaseType = lease.type as LeaseType | undefined
      if (leaseType === undefined) return false

      // Match if lease type is in the allowed set, or if 'ovrigt' is
      // selected and the type isn't one of the known non-övrigt types
      const matches =
        allowedTypes.has(leaseType) ||
        (includesOvrigt && !KNOWN_NON_OVRIGT_TYPES.has(leaseType))
      if (!matches) return false
    }

    // Free-text search (q)
    if (params.q && bl) {
      const q = params.q.toLowerCase().trim()
      const matchFields = [
        lease.leaseId,
        lease.rentalPropertyId,
        ...bl.tenants.map((t) => t.externalId),
        ...bl.tenants.map((t) => t.idbeteckning),
        ...bl.tenants.map((t) =>
          t.name ? `${t.name.first} ${t.name.last}` : t.displayName
        ),
        ...bl.rentalObjects.map((o) => o.postadress ?? ''),
      ]
      if (!matchFields.some((f) => f.toLowerCase().includes(q))) return false
    }

    // Name filter (tenant name)
    if (params.name && bl) {
      const name = params.name.toLowerCase().trim()
      const nameMatch = bl.tenants.some(
        (t) =>
          (t.name
            ? `${t.name.first} ${t.name.last}`.toLowerCase().includes(name)
            : false) || t.displayName.toLowerCase().includes(name)
      )
      if (!nameMatch) return false
    }

    // Address filter (rental object address)
    if (params.address && bl) {
      const addr = params.address.toLowerCase().trim()
      const addrMatch = bl.rentalObjects.some((o) =>
        (o.postadress ?? '').toLowerCase().includes(addr)
      )
      if (!addrMatch) return false
    }

    // Property filter (fastighetsbeteckning)
    if (params.property && params.property.length > 0 && bl) {
      const propSet = new Set(params.property.map((p) => p.toLowerCase()))
      const propMatch = bl.rentalObjects.some(
        (o) =>
          o.fastighet &&
          propSet.has(o.fastighet.fastighetsbeteckning.toLowerCase())
      )
      if (!propMatch) return false
    }

    // Date range filters
    if (params.startDateFrom && lease.leaseStartDate) {
      if (lease.leaseStartDate < new Date(params.startDateFrom)) return false
    }
    if (params.startDateTo && lease.leaseStartDate) {
      if (lease.leaseStartDate > new Date(params.startDateTo)) return false
    }
    if (params.endDateFrom && lease.leaseEndDate) {
      if (lease.leaseEndDate < new Date(params.endDateFrom)) return false
    }
    if (params.endDateTo && lease.leaseEndDate) {
      if (lease.leaseEndDate > new Date(params.endDateTo)) return false
    }

    return true
  })
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

  // Personnummer with dash: YYMMDD-XXXX or YYYYMMDD-XXXX
  if (/^\d{6}-\d{4}$/.test(trimmed) || /^\d{8}-\d{4}$/.test(trimmed)) {
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

  // Contains dash but not personnummer and not lease ID → contract number prefix
  if (trimmed.includes('-')) {
    return [{ filterKey: 'filter[externalId]', filterValue: trimmed }]
  }

  // Pure digits, 4+ → personnummer (last 4 digits or full without dash)
  if (/^\d{4,}$/.test(trimmed)) {
    return [
      {
        filterKey: 'filter[hyresgaster][idbeteckning]',
        filterValue: trimmed,
      },
    ]
  }

  // Short numeric (1-3 digits): contract number prefix
  if (/^\d{1,3}$/.test(trimmed)) {
    return [{ filterKey: 'filter[externalId]', filterValue: trimmed }]
  }

  // Default: treat as address search
  return [
    {
      filterKey: 'filter[hyresobjekt][postadress]',
      filterValue: trimmed,
    },
  ]
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
      .filter((t) => t && t !== 'ovrigt') // 'ovrigt' not supported by Tenfast search API
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

  query.set('limit', String(params.limit ?? 20))

  return query
}

/**
 * Fetches all leases matching params using cursor-based pagination.
 * Unlike fetchLeases (which re-traverses from page 1 each call),
 * this function maintains cursor state internally — O(n) API calls total.
 * Used for export to avoid O(n²) repeated cursor traversal.
 */
export async function fetchAllLeasesForExport(
  params: leasing.v1.LeaseSearchQueryParams,
  _ctx: Context
): Promise<leasing.v1.LeaseSearchResult[]> {
  // Check if batch-get path is needed (Xpand-bridged filters)
  const needsBatchGet =
    (params.buildingManager && params.buildingManager.length > 0) ||
    (params.buildingCodes && params.buildingCodes.length > 0) ||
    (params.areaCodes && params.areaCodes.length > 0) ||
    (params.districtNames && params.districtNames.length > 0)

  if (needsBatchGet) {
    return fetchAllLeasesForExportViaBatchGet(params)
  }

  const queryParams = buildTenfastQueryParams({ ...params, limit: 500 })
  const queryString = queryParams
    .toString()
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%2C/gi, ',')
  const baseUrl = `${tenfastBaseUrl}/v1/hyresvard/avtal/search?hyresvard=${tenfastCompanyId}&${queryString}`

  let cursor = ''
  const allLeases: TenfastLease[] = []
  const MAX_PAGES = 50 // safety limit: 50 * 500 = 25,000 max

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = cursor ? `${baseUrl}&paginate=${cursor}` : baseUrl
    const res = await tenfastApi.request({ method: 'get', url })

    if (res.status !== 200) {
      logger.error(
        { status: res.status },
        'fetchAllLeasesForExport: request failed'
      )
      break
    }

    const parsed = TenfastLeaseSchema.array().safeParse(res.data.records)
    if (!parsed.success) {
      logger.error(
        { error: parsed.error.issues.slice(0, 3) },
        'fetchAllLeasesForExport: parse error, skipping page'
      )
      break
    }

    allLeases.push(...parsed.data)
    cursor = res.data.next ?? ''

    if (!cursor || parsed.data.length === 0) break
  }

  return allLeases.map((l) => mapTenfastLeaseToSearchResult(l))
}

/**
 * Export path for Xpand-bridged filters (buildingManager, buildingCodes, etc.).
 * Fetches ALL matching rental object codes from Xpand, then batch-gets all
 * leases from Tenfast and applies local filters.
 */
async function fetchAllLeasesForExportViaBatchGet(
  params: leasing.v1.LeaseSearchQueryParams
): Promise<leasing.v1.LeaseSearchResult[]> {
  // Get rental object codes from Xpand for each active filter
  const codeSetPromises: Promise<string[]>[] = []
  const filterLabels: string[] = []

  if (params.buildingManager && params.buildingManager.length > 0) {
    codeSetPromises.push(
      getRentalObjectCodesByBuildingManager(params.buildingManager)
    )
    filterLabels.push('buildingManager')
  }
  if (params.buildingCodes && params.buildingCodes.length > 0) {
    codeSetPromises.push(
      getRentalObjectCodesByBuildingCodes(params.buildingCodes)
    )
    filterLabels.push('buildingCodes')
  }
  if (params.areaCodes && params.areaCodes.length > 0) {
    codeSetPromises.push(getRentalObjectCodesByAreaCodes(params.areaCodes))
    filterLabels.push('areaCodes')
  }
  if (params.districtNames && params.districtNames.length > 0) {
    codeSetPromises.push(
      getRentalObjectCodesByDistrictNames(params.districtNames)
    )
    filterLabels.push('districtNames')
  }

  const codeSets = await Promise.all(codeSetPromises)

  // Intersect all code sets
  let codes = codeSets[0]
  for (let i = 1; i < codeSets.length; i++) {
    const set = new Set(codeSets[i])
    codes = codes.filter((c) => set.has(c))
  }

  logger.info(
    { filters: filterLabels, intersectedCount: codes.length },
    'fetchAllLeasesForExportViaBatchGet: codes from Xpand'
  )

  if (codes.length === 0) return []

  // Batch-get all leases from Tenfast
  const batchSize = 500
  const seenLeaseIds = new Set<string>()
  const batchLeases: BatchGetLease[] = []

  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize)
    const res = await tenfastApi.request({
      method: 'post',
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/hyresobjekt/batch-get?hyresvard=${tenfastCompanyId}&includeAvtal=signed`,
      data: { externalIds: batch },
    })

    if (res.status !== 200 && res.status !== 201) continue

    const rentalObjects = res.data as Array<Record<string, unknown>>
    for (const ro of rentalObjects) {
      const avtal = ro.avtal as Array<Record<string, unknown>> | undefined
      if (!avtal) continue

      for (const raw of avtal) {
        const leaseId = raw.externalId as string | undefined
        if (!leaseId || seenLeaseIds.has(leaseId)) continue
        seenLeaseIds.add(leaseId)

        const od = raw.originalData as Record<string, unknown> | undefined
        const tenants = (od?.hyresgaster ?? raw.hyresgaster ?? []) as Array<
          Record<string, unknown>
        >

        batchLeases.push({
          externalId: leaseId,
          startDate: raw.startDate
            ? new Date(raw.startDate as string)
            : new Date(),
          endDate: raw.endDate ? new Date(raw.endDate as string) : undefined,
          stage: (raw.stage as string) ?? 'active',
          signedAt: raw.signedAt ? new Date(raw.signedAt as string) : undefined,
          uppsagningstid: (raw.uppsagningstid as string) ?? '',
          cancellation: {
            cancelled: (raw.cancellation as any)?.cancelled ?? false,
            cancelledByType:
              (raw.cancellation as any)?.cancelledByType ?? undefined,
            handledAt: (raw.cancellation as any)?.handledAt
              ? new Date((raw.cancellation as any).handledAt)
              : undefined,
            preferredMoveOutDate: (raw.cancellation as any)
              ?.preferredMoveOutDate
              ? new Date((raw.cancellation as any).preferredMoveOutDate)
              : undefined,
          },
          hyror: ((raw.hyror as any[]) ?? []).map((r) => ({
            _id: r._id ?? '',
            amount: r.amount ?? 0,
            vat: r.vat ?? 0,
            label: r.label ?? '',
            article: r.article ?? '',
            from: r.from ?? undefined,
            to: r.to ?? undefined,
          })),
          tenants: tenants.map((t) => ({
            externalId: (t.externalId as string) ?? '',
            displayName: (t.displayName as string) ?? '',
            name: t.name as { first: string; last: string } | undefined,
            idbeteckning: (t.idbeteckning as string) ?? '',
          })),
          rentalObjects: [
            {
              externalId: (ro.externalId as string) ?? '',
              typ: (ro.typ as string) ?? undefined,
              postadress: (ro.postadress as string) ?? undefined,
              stadsdel: (ro.stadsdel as string) ?? undefined,
              fastighet:
                typeof ro.fastighet === 'object' && ro.fastighet
                  ? {
                      fastighetsbeteckning:
                        (ro.fastighet as any).fastighetsbeteckning ?? '',
                      stadsdel: (ro.fastighet as any).stadsdel,
                    }
                  : undefined,
              kvm: (ro.kvm as number) ?? undefined,
            },
          ],
        })
      }
    }
  }

  // Apply local filters (status, objectType, etc.)
  let leases = batchLeases.map(mapBatchGetLeaseToOnecoreLease)
  leases = applyLocalFilters(leases, batchLeases, params)

  const batchLeaseMap = new Map(batchLeases.map((bl) => [bl.externalId, bl]))
  return leases
    .map((l) => {
      const bl = batchLeaseMap.get(l.leaseId)
      return bl ? mapBatchGetLeaseToSearchResult(bl) : undefined
    })
    .filter((r): r is leasing.v1.LeaseSearchResult => r !== undefined)
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
    const page = params.page ?? 1
    const queryParams = buildTenfastQueryParams(params)
    // Tenfast API expects literal brackets and commas, not URL-encoded
    const queryString = queryParams
      .toString()
      .replace(/%5B/gi, '[')
      .replace(/%5D/gi, ']')
      .replace(/%2C/gi, ',')
    const baseUrl = `${tenfastBaseUrl}/v1/hyresvard/avtal/search?hyresvard=${tenfastCompanyId}&${queryString}`

    let cursor = ''
    let totalCount = 0
    let records: unknown[] = []

    // Navigate through Tenfast cursor pages to reach the requested page.
    // Each iteration fetches one page; we only parse the final (target) page.
    for (let currentPage = 1; currentPage <= page; currentPage++) {
      const url = cursor ? `${baseUrl}&paginate=${cursor}` : baseUrl

      const res = await tenfastApi.request({ method: 'get', url })

      if (res.status !== 200) {
        logger.error(
          { status: res.status, data: res.data },
          'tenfast-lease-search-adapter.fetchLeases: Failed to fetch leases'
        )
        return { ok: false, err: 'unknown' }
      }

      records = res.data.records

      if (currentPage === 1) {
        totalCount = res.data.totalCount ?? 0
      }

      cursor = res.data.next ?? ''

      // If there are no more pages and we haven't reached the target yet,
      // the requested page is beyond the available data.
      if (!cursor && currentPage < page) {
        return { ok: true, data: { leases: [], totalCount } }
      }
    }

    // Parse only the target page's records
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

export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  // Bridge Xpand-only filters via batch-get:
  // buildingManager, buildingCodes, areaCodes, districtNames
  // 1. Get rental object codes from Xpand for each active filter
  // 2. Intersect the code sets (all filters must match)
  // 3. Call Tenfast batch-get with those codes
  // 4. Map, apply remaining filters, sort and paginate locally
  const needsBatchGet =
    (params.buildingManager && params.buildingManager.length > 0) ||
    (params.buildingCodes && params.buildingCodes.length > 0) ||
    (params.areaCodes && params.areaCodes.length > 0) ||
    (params.districtNames && params.districtNames.length > 0)

  if (needsBatchGet) {
    // Fetch rental object code sets in parallel for each active filter
    const codeSetPromises: Promise<string[]>[] = []
    const filterLabels: string[] = []

    if (params.buildingManager && params.buildingManager.length > 0) {
      codeSetPromises.push(
        getRentalObjectCodesByBuildingManager(params.buildingManager)
      )
      filterLabels.push('buildingManager')
    }
    if (params.buildingCodes && params.buildingCodes.length > 0) {
      codeSetPromises.push(
        getRentalObjectCodesByBuildingCodes(params.buildingCodes)
      )
      filterLabels.push('buildingCodes')
    }
    if (params.areaCodes && params.areaCodes.length > 0) {
      codeSetPromises.push(getRentalObjectCodesByAreaCodes(params.areaCodes))
      filterLabels.push('areaCodes')
    }
    if (params.districtNames && params.districtNames.length > 0) {
      codeSetPromises.push(
        getRentalObjectCodesByDistrictNames(params.districtNames)
      )
      filterLabels.push('districtNames')
    }

    const codeSets = await Promise.all(codeSetPromises)

    // Intersect all code sets — a rental object must match ALL active filters
    let codes = codeSets[0]
    for (let i = 1; i < codeSets.length; i++) {
      const set = new Set(codeSets[i])
      codes = codes.filter((c) => set.has(c))
    }

    logger.info(
      {
        filters: filterLabels,
        codeCounts: codeSets.map((s, i) => `${filterLabels[i]}=${s.length}`),
        intersectedCount: codes.length,
      },
      'Xpand-bridged filters: rental object codes from Xpand'
    )

    if (codes.length === 0) {
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

    // Lazy batch-get: fetch batches one at a time until we have enough
    // results for the requested page. This avoids downloading ALL data
    // when the code set is large (e.g., 10,000 codes for broad district filters).
    const batchSize = 500
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const needed = page * limit // total results needed to fill through current page

    const seenLeaseIds = new Set<string>()
    const batchLeases: BatchGetLease[] = []
    let batchesFetched = 0
    const totalBatches = Math.ceil(codes.length / batchSize)

    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize)

      const res = await tenfastApi.request({
        method: 'post',
        url: `${tenfastBaseUrl}/v1/hyresvard/extras/hyresobjekt/batch-get?hyresvard=${tenfastCompanyId}&includeAvtal=signed`,
        data: { externalIds: batch },
      })

      batchesFetched++

      if (res.status !== 200 && res.status !== 201) {
        logger.error(
          { status: res.status, data: res.data },
          'Xpand-bridged filters: batch-get failed'
        )
        continue
      }

      const rentalObjects = res.data as Array<Record<string, unknown>>

      for (const ro of rentalObjects) {
        const avtal = ro.avtal as Array<Record<string, unknown>> | undefined
        if (!avtal) continue

        for (const raw of avtal) {
          const leaseId = raw.externalId as string | undefined
          if (!leaseId || seenLeaseIds.has(leaseId)) continue
          seenLeaseIds.add(leaseId)

          const od = raw.originalData as Record<string, unknown> | undefined
          const tenants = (od?.hyresgaster ?? raw.hyresgaster ?? []) as Array<
            Record<string, unknown>
          >

          batchLeases.push({
            externalId: leaseId,
            startDate: raw.startDate
              ? new Date(raw.startDate as string)
              : new Date(),
            endDate: raw.endDate ? new Date(raw.endDate as string) : undefined,
            stage: (raw.stage as string) ?? 'active',
            signedAt: raw.signedAt
              ? new Date(raw.signedAt as string)
              : undefined,
            uppsagningstid: (raw.uppsagningstid as string) ?? '',
            cancellation: {
              cancelled: (raw.cancellation as any)?.cancelled ?? false,
              cancelledByType:
                (raw.cancellation as any)?.cancelledByType ?? undefined,
              handledAt: (raw.cancellation as any)?.handledAt
                ? new Date((raw.cancellation as any).handledAt)
                : undefined,
              preferredMoveOutDate: (raw.cancellation as any)
                ?.preferredMoveOutDate
                ? new Date((raw.cancellation as any).preferredMoveOutDate)
                : undefined,
            },
            hyror: ((raw.hyror as any[]) ?? []).map((r) => ({
              _id: r._id ?? '',
              amount: r.amount ?? 0,
              vat: r.vat ?? 0,
              label: r.label ?? '',
              article: r.article ?? '',
              from: r.from ?? undefined,
              to: r.to ?? undefined,
            })),
            tenants: tenants.map((t) => ({
              externalId: (t.externalId as string) ?? '',
              displayName: (t.displayName as string) ?? '',
              name: t.name as { first: string; last: string } | undefined,
              idbeteckning: (t.idbeteckning as string) ?? '',
            })),
            rentalObjects: [
              {
                externalId: (ro.externalId as string) ?? '',
                typ: (ro.typ as string) ?? undefined,
                postadress: (ro.postadress as string) ?? undefined,
                stadsdel: (ro.stadsdel as string) ?? undefined,
                fastighet:
                  typeof ro.fastighet === 'object' && ro.fastighet
                    ? {
                        fastighetsbeteckning:
                          (ro.fastighet as any).fastighetsbeteckning ?? '',
                        stadsdel: (ro.fastighet as any).stadsdel,
                      }
                    : undefined,
                kvm: (ro.kvm as number) ?? undefined,
              },
            ],
          })
        }
      }

      // Apply local filters to check if we have enough results
      const currentLeases = batchLeases.map(mapBatchGetLeaseToOnecoreLease)
      const filtered = applyLocalFilters(currentLeases, batchLeases, params)

      // Stop fetching if we have enough to fill the requested page
      if (filtered.length >= needed) {
        break
      }
    }

    let leases = batchLeases.map(mapBatchGetLeaseToOnecoreLease)
    leases = applyLocalFilters(leases, batchLeases, params)

    // Estimate total count based on hit rate from fetched batches
    const hitRate =
      batchesFetched < totalBatches && leases.length > 0
        ? leases.length / (batchesFetched * batchSize)
        : 0
    const estimatedTotal =
      batchesFetched >= totalBatches
        ? leases.length
        : Math.round(hitRate * codes.length)
    const totalCount =
      batchesFetched >= totalBatches ? leases.length : estimatedTotal

    // Map filtered leases to LeaseSearchResult
    const batchLeaseMap = new Map(batchLeases.map((bl) => [bl.externalId, bl]))
    const searchResults = leases
      .map((l) => {
        const bl = batchLeaseMap.get(l.leaseId)
        return bl ? mapBatchGetLeaseToSearchResult(bl) : undefined
      })
      .filter((r): r is leasing.v1.LeaseSearchResult => r !== undefined)

    logger.info(
      {
        batchesFetched,
        totalBatches,
        uniqueLeases: seenLeaseIds.size,
        afterFilters: searchResults.length,
        estimatedTotal: totalCount,
      },
      'Xpand-bridged filters: lazy batch-get completed'
    )

    const sorted = applySorting(searchResults, params)
    const start = (page - 1) * limit
    const pageSlice = sorted.slice(start, start + limit)
    const totalPages = Math.ceil(totalCount / limit)

    return {
      content: pageSlice,
      _meta: {
        totalRecords: totalCount,
        page,
        limit,
        count: pageSlice.length,
      },
      _links: buildPaginationLinks(ctx, page, limit, totalPages),
    }
  }

  // Standard path — no post-filtering, Tenfast handles pagination
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const leasesResult = await fetchLeases(params)

  if (!leasesResult.ok) {
    throw new Error(`Failed to fetch leases from Tenfast: ${leasesResult.err}`)
  }

  const { leases: tenfastLeases, totalCount } = leasesResult.data

  const searchResults = tenfastLeases.map((l) =>
    mapTenfastLeaseToSearchResult(l)
  )
  const sortedResults = applySorting(searchResults, params)
  const totalPages = Math.ceil(totalCount / limit)

  return {
    content: sortedResults,
    _meta: {
      totalRecords: totalCount,
      page,
      limit,
      count: sortedResults.length,
    },
    _links: buildPaginationLinks(ctx, page, limit, totalPages),
  }
}
