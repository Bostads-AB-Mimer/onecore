import { Knex } from 'knex'
import { Context } from 'koa'
import { leasing, LeaseStatus } from '@onecore/types'
import { paginateKnex, PaginatedResponse } from '@onecore/utilities'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'
import { calculateStatus } from '../../helpers/transformFromXPandDb'

/** Maps enum values to normalized status keys */
const STATUS_ENUM_MAP: Record<string, string> = {
  [LeaseStatus.Current]: 'current',
  [LeaseStatus.Upcoming]: 'upcoming',
  [LeaseStatus.AboutToEnd]: 'abouttoend',
  [LeaseStatus.Ended]: 'ended',
}

/** Maps normalized status keys to SQL WHERE conditions */
const STATUS_CONDITIONS: Record<
  string,
  (qb: Knex.QueryBuilder, date: string) => void
> = {
  current: (qb, date) =>
    qb.where('hyobj.fdate', '<=', date).whereNull('hyobj.sistadeb'),
  upcoming: (qb, date) => qb.where('hyobj.fdate', '>=', date),
  abouttoend: (qb, date) =>
    qb.whereNotNull('hyobj.sistadeb').where('hyobj.sistadeb', '>=', date),
  ended: (qb, date) =>
    qb.whereNotNull('hyobj.sistadeb').where('hyobj.sistadeb', '<', date),
}

const normalizeStatus = (status: string): string =>
  STATUS_ENUM_MAP[status] ?? status.toLowerCase()

/**
 * Modular query builder for lease search
 * Only joins tables when filters require them
 */
class LeaseSearchQueryBuilder {
  private query: Knex.QueryBuilder
  private joinedTables: Set<string>
  private params: leasing.v1.LeaseSearchQueryParams

  constructor(params: leasing.v1.LeaseSearchQueryParams) {
    this.params = params
    this.joinedTables = new Set()
    this.query = this.buildBaseQuery()
  }

  /**
   * Base query always includes:
   * - hyobj (leases)
   * - hyhav (lease type)
   * - hykop (lease-object link)
   * - cmobj (object registry, has keycmobt for object type filtering)
   */
  private buildBaseQuery(): Knex.QueryBuilder {
    const query = xpandDb('hyobj')
      .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
      .innerJoin('hykop', function () {
        this.on('hykop.keyhyobj', '=', 'hyobj.keyhyobj').andOn(
          'hykop.ordning',
          '=',
          xpandDb.raw('?', [1])
        )
      })
      .innerJoin('cmobj', 'cmobj.keycmobj', 'hykop.keycmobj')
      .where('hyobj.deletemark', 0)

    this.joinedTables.add('hyobj')
    this.joinedTables.add('hyhav')
    this.joinedTables.add('hykop')
    this.joinedTables.add('cmobj')

    return query
  }

  /**
   * Ensure address table is joined
   */
  private ensureAddressJoin(): void {
    if (!this.joinedTables.has('cmadr')) {
      this.query.leftJoin('cmadr', function () {
        this.on('cmadr.keycode', '=', 'hykop.keycmobj').andOn(
          'cmadr.keydbtbl',
          '=',
          xpandDb.raw('?', ['_RQA11RNMA'])
        )
      })

      this.joinedTables.add('cmadr')
    }
  }

  /**
   * Ensure babuf (rental units) table is joined
   */
  private ensureBabufJoin(): void {
    if (!this.joinedTables.has('babuf')) {
      this.query.innerJoin('babuf', 'babuf.keycmobj', 'hykop.keycmobj')
      this.joinedTables.add('babuf')
    }
  }

  /**
   * Ensure property table is joined
   */
  private ensurePropertyJoin(): void {
    this.ensureBabufJoin()
    if (!this.joinedTables.has('bafst')) {
      this.query.innerJoin('bafst', 'bafst.keycmobj', 'babuf.keyobjfst')
      this.joinedTables.add('bafst')
    }
  }

  /**
   * Ensure area (område) table is joined
   */
  private ensureAreaJoin(): void {
    this.ensurePropertyJoin()
    if (!this.joinedTables.has('babya')) {
      this.query.innerJoin('babya', 'babya.keybabya', 'bafst.keybabya')
      this.joinedTables.add('babya')
    }
  }

  /**
   * Ensure neighborhood manager (kvartersvärd) table is joined
   */
  private ensureDistrictJoin(): void {
    this.ensureBabufJoin()
    if (!this.joinedTables.has('bafen')) {
      this.query.leftJoin('bafen', 'bafen.code', 'babuf.fencode')
      this.joinedTables.add('bafen')
    }
  }

  /**
   * Apply text search filter
   * Uses LEFT JOINs to search on contact fields
   */
  applySearch(): this {
    if (this.params.q) {
      const searchTerm = `%${this.params.q}%`

      // Add LEFT JOIN for contact search
      if (!this.joinedTables.has('cmctc')) {
        this.query
          .leftJoin('hyavk', 'hyavk.keyhyobj', 'hyobj.keyhyobj')
          .leftJoin('cmctc', 'cmctc.keycmctc', 'hyavk.keycmctc')
        this.joinedTables.add('hyavk')
        this.joinedTables.add('cmctc')
      }

      this.ensureAddressJoin()

      this.query.where(function () {
        this.where('hyobj.hyobjben', 'like', searchTerm)
          .orWhere('cmctc.cmctcben', 'like', searchTerm)
          .orWhere('cmctc.persorgnr', 'like', searchTerm)
          .orWhere('cmctc.cmctckod', 'like', searchTerm)
          .orWhere('cmadr.adress1', 'like', searchTerm)
      })
    }

    return this
  }

  /**
   * Apply object type filter
   */
  applyObjectTypeFilter(): this {
    if (this.params.objectType && this.params.objectType.length > 0) {
      this.query.whereIn('cmobj.keycmobt', this.params.objectType)
    }

    return this
  }

  /**
   * Apply status filter
   * Uses STATUS_CONDITIONS lookup for cleaner code
   */
  applyStatusFilter(): this {
    if (!this.params.status?.length) return this

    const statuses = this.params.status
    const currentDate = new Date().toISOString().split('T')[0]

    this.query.where(function () {
      for (const status of statuses) {
        const condition = STATUS_CONDITIONS[normalizeStatus(status)]
        if (condition) {
          this.orWhere((qb) => condition(qb, currentDate))
        }
      }
    })

    return this
  }

  /**
   * Apply date range filters
   */
  applyDateFilters(): this {
    if (this.params.startDateFrom) {
      this.query.where('hyobj.fdate', '>=', this.params.startDateFrom)
    }

    if (this.params.startDateTo) {
      this.query.where('hyobj.fdate', '<=', this.params.startDateTo)
    }

    if (this.params.endDateFrom) {
      this.query.where('hyobj.sistadeb', '>=', this.params.endDateFrom)
    }

    if (this.params.endDateTo) {
      this.query.where('hyobj.sistadeb', '<=', this.params.endDateTo)
    }

    return this
  }

  /**
   * Apply property filter
   */
  applyPropertyFilter(): this {
    if (this.params.propertyCodes && this.params.propertyCodes.length > 0) {
      this.ensureBabufJoin()
      this.query.whereIn('babuf.fstcode', this.params.propertyCodes)
    }

    return this
  }

  /**
   * Apply building filter
   */
  applyBuildingFilter(): this {
    if (this.params.buildingCodes && this.params.buildingCodes.length > 0) {
      this.ensureBabufJoin()
      this.query.whereIn('babuf.bygcode', this.params.buildingCodes)
    }

    return this
  }

  /**
   * Apply area filter (Område)
   */
  applyAreaFilter(): this {
    if (this.params.areaCodes && this.params.areaCodes.length > 0) {
      this.ensureAreaJoin()
      this.query.whereIn('babya.code', this.params.areaCodes)
    }

    return this
  }

  /**
   * Apply district filter
   */
  applyDistrictFilter(): this {
    if (this.params.districtNames && this.params.districtNames.length > 0) {
      this.ensureDistrictJoin()
      this.query.whereIn('bafen.distrikt', this.params.districtNames)
    }

    return this
  }

  /**
   * Apply building manager filter (Kvartersvärd)
   */
  applyBuildingManagerFilter(): this {
    if (
      this.params.buildingManagerCodes &&
      this.params.buildingManagerCodes.length > 0
    ) {
      this.ensureDistrictJoin()
      this.query.whereIn('bafen.code', this.params.buildingManagerCodes)
    }

    return this
  }

  /**
   * Ensure all joins needed for response fields
   * Contact/email/phone are fetched separately via getContactsForLeases()
   */
  /**
   * Build SELECT fields
   * Uses DISTINCT to prevent duplicate rows from search joins
   * Only selects property/area/district fields if those filters were used
   */
  buildSelectFields(): this {
    // Always join address for display
    this.ensureAddressJoin()

    // DISTINCT prevents duplicates when search join matches multiple contacts
    this.query.distinct()

    // Always selected (core display fields)
    this.query.select(
      'hyobj.keyhyobj', // Needed for contact batch lookup
      'hyobj.hyobjben as leaseId',
      'hyobj.fdate as startDate',
      'hyobj.sistadeb as lastDebitDate',
      'cmobj.keycmobt as objectTypeCode',
      'hyhav.hyhavben as leaseType',
      'cmadr.adress1 as address'
    )

    // Conditionally select if tables were joined by filters
    if (this.joinedTables.has('babuf')) {
      this.query.select(
        'babuf.fstcode as propertyCode',
        'babuf.fstcaption as propertyCaption',
        'babuf.bygcode as buildingCode',
        'babuf.bygcaption as buildingCaption'
      )
    }

    if (this.joinedTables.has('babya')) {
      this.query.select('babya.code as areaCode', 'babya.caption as areaName')
    }

    if (this.joinedTables.has('bafen')) {
      this.query.select(
        'bafen.code as buildingManagerCode',
        'bafen.caption as managementUnitName',
        'bafen.omrade as buildingManagerName',
        'bafen.distrikt as districtName'
      )
    }

    return this
  }

  /**
   * Apply sorting
   * Note: tenantName sorting removed since contacts are fetched separately
   */
  applySorting(): this {
    const sortBy = this.params.sortBy || 'leaseStartDate'
    const sortOrder = this.params.sortOrder || 'desc'

    const sortFieldMap: Record<string, string> = {
      leaseStartDate: 'hyobj.fdate',
      lastDebitDate: 'hyobj.sistadeb',
      leaseId: 'hyobj.hyobjben',
    }

    const sortField = sortFieldMap[sortBy] || 'hyobj.fdate'
    this.query.orderBy(sortField, sortOrder)

    return this
  }

  /**
   * Get the built query
   */
  getQuery(): Knex.QueryBuilder {
    return this.query
  }
}

/**
 * Map object type codes to Swedish labels
 */
const getObjectTypeLabel = (objectTypeCode: string): string => {
  const typeMap: Record<string, string> = {
    balgh: 'Bostad',
    babps: 'Parkering',
    balok: 'Lokal',
    bahyr: 'Övrigt',
  }
  return typeMap[objectTypeCode] || objectTypeCode
}

/**
 * Batch fetch contacts for a list of lease keys
 * Returns a Map from leaseKey to array of ContactInfo
 */
const getContactsForLeases = async (
  leaseKeys: string[]
): Promise<Map<string, leasing.v1.ContactInfo[]>> => {
  if (leaseKeys.length === 0) {
    return new Map()
  }

  // Query 1: Get contacts for all leases
  const rows = await xpandDb
    .from('hyavk')
    .select(
      'hyavk.keyhyobj as leaseKey',
      'cmctc.cmctcben as name',
      'cmctc.cmctckod as contactCode',
      'cmctc.keycmobj'
    )
    .innerJoin('cmctc', 'cmctc.keycmctc', 'hyavk.keycmctc')
    .whereIn('hyavk.keyhyobj', leaseKeys)

  if (rows.length === 0) {
    const result = new Map<string, leasing.v1.ContactInfo[]>()
    leaseKeys.forEach((key) => result.set(key, []))
    return result
  }

  const keycmobjs = [...new Set(rows.map((r) => r.keycmobj as string))]

  // Batch fetch emails and phones in parallel
  const [emailRows, phoneRows] = await Promise.all([
    xpandDb
      .from('cmeml')
      .select('keycmobj', 'cmemlben as email')
      .whereIn('keycmobj', keycmobjs)
      .where('main', 1),
    xpandDb
      .from('cmtel')
      .select('keycmobj', 'cmtelben as phone')
      .whereIn('keycmobj', keycmobjs)
      .where('main', 1),
  ])

  // Build lookups
  const emailByKeycmobj = new Map(
    emailRows.map((r) => [r.keycmobj, trimRow(r).email as string])
  )
  const phoneByKeycmobj = new Map(
    phoneRows.map((r) => [r.keycmobj, trimRow(r).phone as string])
  )

  // Group contacts by lease key
  const result = new Map<string, leasing.v1.ContactInfo[]>()
  leaseKeys.forEach((key) => result.set(key, []))

  for (const row of rows) {
    const trimmed = trimRow(row)
    const contact: leasing.v1.ContactInfo = {
      name: trimmed.name as string,
      contactCode: trimmed.contactCode as string,
      email: emailByKeycmobj.get(row.keycmobj as string) || null,
      phone: phoneByKeycmobj.get(row.keycmobj as string) || null,
    }
    result.get(row.leaseKey as string)!.push(contact)
  }

  return result
}

/**
 * Transform database row to LeaseSearchResult with calculated status
 * Contacts are attached separately via getContactsForLeases()
 * Only includes optional fields (property/area/district) if they were selected
 * Fields are omitted entirely when not queried (vs null when queried but empty in DB)
 */
const transformRow = (
  row: any
): Omit<leasing.v1.LeaseSearchResult, 'contacts'> => {
  const trimmedRow = trimRow(row)

  const status = calculateStatus(
    trimmedRow.lastDebitDate ? String(trimmedRow.lastDebitDate) : '',
    trimmedRow.startDate ? String(trimmedRow.startDate) : ''
  )

  const result: Omit<leasing.v1.LeaseSearchResult, 'contacts'> = {
    leaseId: trimmedRow.leaseId,
    objectTypeCode: getObjectTypeLabel(trimmedRow.objectTypeCode),
    leaseType: trimmedRow.leaseType,
    address: trimmedRow.address || null,
    startDate: trimmedRow.startDate || null,
    lastDebitDate: trimmedRow.lastDebitDate || null,
    status,
  }

  // Only include optional fields if they were selected (filter was used)
  // Omit entirely when not queried, null when queried but empty in DB
  if (trimmedRow.propertyCode !== undefined) {
    result.propertyCode = trimmedRow.propertyCode || null
    result.propertyCaption = trimmedRow.propertyCaption || null
    result.buildingCode = trimmedRow.buildingCode || null
    result.buildingCaption = trimmedRow.buildingCaption || null
  }

  if (trimmedRow.areaCode !== undefined) {
    result.areaCode = trimmedRow.areaCode || null
    result.areaName = trimmedRow.areaName || null
  }

  if (trimmedRow.buildingManagerCode !== undefined) {
    result.buildingManagerCode = trimmedRow.buildingManagerCode || null
    result.managementUnitName = trimmedRow.managementUnitName || null
    result.buildingManagerName = trimmedRow.buildingManagerName || null
    result.districtName = trimmedRow.districtName || null
  }

  return result
}

/**
 * Main search function with pagination
 */
export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const builder = new LeaseSearchQueryBuilder(params)

  // Apply all filters based on params
  builder
    .applySearch()
    .applyObjectTypeFilter()
    .applyStatusFilter()
    .applyDateFilters()
    .applyPropertyFilter()
    .applyBuildingFilter()
    .applyAreaFilter()
    .applyDistrictFilter()
    .applyBuildingManagerFilter()
    .buildSelectFields()
    .applySorting()

  const query = builder.getQuery()

  // Use pagination utility
  const paginatedResult = await paginateKnex<any>(
    query,
    ctx,
    {},
    params.limit
  )

  // Batch fetch contacts for all leases in this page
  const leaseKeys = paginatedResult.content.map(
    (row: any) => row.keyhyobj as string
  )
  const contactsByLeaseKey = await getContactsForLeases(leaseKeys)

  // Transform rows and attach contacts
  const transformedContent = paginatedResult.content.map((row: any) => {
    const basicData = transformRow(row)
    const contacts = contactsByLeaseKey.get(row.keyhyobj as string) || []
    return { ...basicData, contacts }
  })

  return {
    ...paginatedResult,
    content: transformedContent,
  }
}
