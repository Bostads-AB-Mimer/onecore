import { Knex } from 'knex'
import { Context } from 'koa'
import { leasing, LeaseStatus } from '@onecore/types'
import { paginateKnex, PaginatedResponse } from '@onecore/utilities'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'
import { calculateStatus } from '../../helpers/transformFromXPandDb'
import { analyzeSearchTerm } from '../../helpers/searchTermAnalyzer'

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

/** Maps friendly object type names to Xpand database codes */
const OBJECT_TYPE_MAP: Record<string, string> = {
  bostad: 'balgh',
  parkering: 'babps',
  lokal: 'balok',
  ovrigt: 'bahyr',
}

/** Convert friendly object type to DB code (passes through if already a DB code) */
const normalizeObjectType = (type: string): string =>
  OBJECT_TYPE_MAP[type.toLowerCase()] ?? type

/**
 * Modular query builder for lease search
 * Only joins tables when filters require them
 */
export class LeaseSearchQueryBuilder {
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
      .whereNot('hyobj.hyobjben', 'like', '%M%')

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
   * Uses smart analysis to only search relevant columns based on input pattern
   * Uses EXISTS subquery for contact search to avoid row duplication
   */
  applySearch(): this {
    if (this.params.q) {
      const targets = analyzeSearchTerm(this.params.q)

      // Separate targets into contact columns (need EXISTS) and direct columns
      const contactTargets = targets.filter((t) =>
        t.column.startsWith('cmctc.')
      )
      const directTargets = targets.filter(
        (t) => !t.column.startsWith('cmctc.')
      )

      // Ensure address join if we're searching address
      if (directTargets.some((t) => t.column.startsWith('cmadr.'))) {
        this.ensureAddressJoin()
      }

      this.query.where(function () {
        // Direct columns (hyobj, cmadr)
        directTargets.forEach((target, i) => {
          if (i === 0 && contactTargets.length === 0) {
            this.where(target.column, 'like', target.pattern)
          } else {
            this.orWhere(target.column, 'like', target.pattern)
          }
        })

        // Contact columns via EXISTS subquery
        if (contactTargets.length > 0) {
          this.orWhereExists(function () {
            this.select(xpandDb.raw(1))
              .from('hyavk')
              .innerJoin('cmctc', 'cmctc.keycmctc', 'hyavk.keycmctc')
              .whereRaw('hyavk.keyhyobj = hyobj.keyhyobj')
              .where(function () {
                contactTargets.forEach((target, i) => {
                  if (i === 0) {
                    this.where(target.column, 'like', target.pattern)
                  } else {
                    this.orWhere(target.column, 'like', target.pattern)
                  }
                })
              })
          })
        }
      })
    }

    return this
  }

  /**
   * Apply object type filter
   * Accepts friendly names (bostad, parkering, lokal, ovrigt) or DB codes (balgh, babps, balok, bahyr)
   */
  applyObjectTypeFilter(): this {
    if (this.params.objectType && this.params.objectType.length > 0) {
      const dbCodes = this.params.objectType.map(normalizeObjectType)
      this.query.whereIn('cmobj.keycmobt', dbCodes)
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
   * Filters by property name (fstcaption) not code
   */
  applyPropertyFilter(): this {
    if (this.params.property && this.params.property.length > 0) {
      this.ensureBabufJoin()
      this.query.whereIn('babuf.fstcaption', this.params.property)
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
    if (this.params.buildingManager && this.params.buildingManager.length > 0) {
      this.ensureDistrictJoin()
      this.query.whereIn('bafen.omrade', this.params.buildingManager)
    }

    return this
  }

  /**
   * Build SELECT fields
   * Only selects property/area/district fields if those filters were used
   */
  buildSelectFields(): this {
    // Always join address for display
    this.ensureAddressJoin()

    // Always selected (core display fields)
    this.query.select(
      'hyobj.keyhyobj',
      'hyobj.hyobjben as leaseId',
      'hyobj.fdate as startDate',
      'hyobj.sistadeb as lastDebitDate',
      'cmobj.keycmobt as objectTypeCode',
      'hyhav.hyhavben as leaseType',
      'cmadr.adress1 as address'
    )

    // Add JSON subquery to fetch contacts with email/phone in one go
    this.query.select(
      xpandDb.raw(`(
        SELECT
          cmctc.cmctcben as name,
          cmctc.cmctckod as contactCode,
          cmeml.cmemlben as email,
          cmtel.cmtelben as phone
        FROM hyavk
        INNER JOIN cmctc ON cmctc.keycmctc = hyavk.keycmctc
        LEFT JOIN cmeml ON cmeml.keycmobj = cmctc.keycmobj AND cmeml.main = 1
        LEFT JOIN cmtel ON cmtel.keycmobj = cmctc.keycmobj AND cmtel.main = 1
        WHERE hyavk.keyhyobj = hyobj.keyhyobj
        FOR JSON PATH
      ) as contactsJson`)
    )

    // Conditionally select if tables were joined by filters
    if (this.joinedTables.has('babuf')) {
      this.query.select(
        'babuf.fstcaption as property',
        'babuf.bygcode as buildingCode'
      )
    }

    if (this.joinedTables.has('babya')) {
      this.query.select('babya.caption as area')
    }

    if (this.joinedTables.has('bafen')) {
      this.query.select(
        'bafen.omrade as buildingManager',
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
export const getObjectTypeLabel = (objectTypeCode: string): string => {
  const typeMap: Record<string, string> = {
    balgh: 'Bostad',
    babps: 'Parkering',
    balok: 'Lokal',
    bahyr: 'Övrigt',
  }
  return typeMap[objectTypeCode] || objectTypeCode
}

/**
 * Map numeric status to Swedish label for Excel export
 */
export const getStatusLabel = (status: LeaseStatus): string => {
  const statusMap: Record<number, string> = {
    [LeaseStatus.Current]: 'Pågående',
    [LeaseStatus.Upcoming]: 'Kommande',
    [LeaseStatus.AboutToEnd]: 'Avslutas snart',
    [LeaseStatus.Ended]: 'Avslutat',
  }
  return statusMap[status] || String(status)
}

/**
 * Transform database row to LeaseSearchResult with calculated status
 * Only includes optional fields (property/area/district) if they were selected
 * Fields are omitted entirely when not queried (vs null when queried but empty in DB)
 */
export const transformRow = (
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
  if (trimmedRow.property !== undefined) {
    result.property = trimmedRow.property || null
    result.buildingCode = trimmedRow.buildingCode || null
  }

  if (trimmedRow.area !== undefined) {
    result.area = trimmedRow.area || null
  }

  if (trimmedRow.buildingManager !== undefined) {
    result.buildingManager = trimmedRow.buildingManager || null
    result.districtName = trimmedRow.districtName || null
  }

  return result
}

// TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
/**
 * Parse contacts JSON from the SQL subquery result
 */
export const parseContactsJson = (
  contactsJson: string | null
): leasing.v1.ContactInfo[] => {
  if (!contactsJson) return []

  try {
    const parsed = JSON.parse(contactsJson)
    return parsed.map((c: any) => ({
      name: c.name ? String(c.name).trim() : '',
      contactCode: c.contactCode ? String(c.contactCode).trim() : '',
      email: c.email ? String(c.email).trim() : null,
      phone: c.phone ? String(c.phone).trim() : null,
    }))
  } catch {
    return []
  }
}

export const getBuildingManagers = async (): Promise<
  { code: string; name: string; district: string }[]
> => {
  const rows = await xpandDb
    .from('bafen')
    .select(
      'bafen.code as code',
      'bafen.omrade as name',
      'bafen.distrikt as district'
    )
    .distinct()
    .whereNotNull('bafen.omrade')
    .where('bafen.omrade', '!=', '')
    .orderBy('bafen.distrikt')
    .orderBy('bafen.omrade')

  return rows.map((row: { code: string; name: string; district: string }) => ({
    code: row.code.trim(),
    name: row.name.trim(),
    district: row.district?.trim() ?? '',
  }))
}

/**
 * Apply all standard filters to a query builder
 * Shared between search and export to avoid duplication
 */
const applyAllFilters = (builder: LeaseSearchQueryBuilder): void => {
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
}

/**
 * Main search function with pagination
 */
export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const builder = new LeaseSearchQueryBuilder(params)
  applyAllFilters(builder)

  const query = builder.getQuery()

  // DEBUG: Log SQL query and timing
  const sqlDebug = query.toSQL()
  console.log('=== LEASE SEARCH SQL ===')
  console.log('SQL:', sqlDebug.sql)
  console.log('Bindings:', sqlDebug.bindings)
  console.log('========================')

  const startQuery = Date.now()
  // Use pagination utility
  const paginatedResult = await paginateKnex<any>(query, ctx, {}, params.limit)
  const queryTime = Date.now() - startQuery
  console.log(`Main query time (with contacts): ${queryTime}ms`)

  // Transform rows and parse contacts JSON
  const transformedContent = paginatedResult.content.map((row: any) => {
    const basicData = transformRow(row)
    const contacts = parseContactsJson(row.contactsJson)
    return { ...basicData, contacts }
  })

  return {
    ...paginatedResult,
    content: transformedContent,
  }
}
