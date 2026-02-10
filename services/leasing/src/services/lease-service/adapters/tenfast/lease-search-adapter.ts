import { Context } from 'koa'
import { leasing, LeaseStatus } from '@onecore/types'
import { PaginatedResponse, logger } from '@onecore/utilities'

import { TenfastLease, TenfastLeaseSchema, TenfastTenant } from './schemas'
import config from '../../../../common/config'
import * as tenfastApi from './tenfast-api'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

/**
 * Calculate lease status based on dates and cancellation state
 */
const calculateLeaseStatus = (lease: TenfastLease): LeaseStatus => {
  const now = new Date()

  if (lease.startDate >= now) {
    return LeaseStatus.Upcoming
  }

  if (lease.endDate && lease.endDate < now) {
    return LeaseStatus.Ended
  }

  if (lease.cancellation.cancelled && lease.endDate && lease.endDate >= now) {
    return LeaseStatus.AboutToEnd
  }

  return LeaseStatus.Current
}

/**
 * Map TenFAST tenant to ContactInfo
 */
const mapTenantToContact = (tenant: TenfastTenant): leasing.v1.ContactInfo => ({
  name: tenant.displayName || `${tenant.name.first} ${tenant.name.last}`.trim(),
  contactCode: tenant.externalId,
  email: null, // TenFAST tenant schema doesn't include email directly
  phone: tenant.phone || null,
})

/**
 * Transform TenFAST lease to LeaseSearchResult
 */
const transformToSearchResult = (
  lease: TenfastLease
): leasing.v1.LeaseSearchResult => {
  const rentalObject = lease.hyresobjekt[0]

  return {
    leaseId: lease.externalId,
    objectTypeCode: rentalObject?.subType || 'unknown',
    leaseType: 'Bostadskontrakt', // TenFAST doesn't expose lease type directly, could be derived from template
    contacts: lease.hyresgaster.map(mapTenantToContact),
    address: rentalObject?.postadress || null,
    startDate: lease.startDate,
    lastDebitDate: lease.endDate,
    status: calculateLeaseStatus(lease),
  }
}

/**
 * Filter leases by status
 */
const filterByStatus = (
  leases: TenfastLease[],
  statuses: string[] | undefined
): TenfastLease[] => {
  if (!statuses || statuses.length === 0) {
    return leases
  }

  const normalizedStatuses = statuses.map((s) => s.toLowerCase())

  return leases.filter((lease) => {
    const status = calculateLeaseStatus(lease)

    return normalizedStatuses.some((s) => {
      switch (s) {
        case 'current':
        case '0':
          return status === LeaseStatus.Current
        case 'upcoming':
        case '1':
          return status === LeaseStatus.Upcoming
        case 'abouttoend':
        case 'about-to-end':
        case '2':
          return status === LeaseStatus.AboutToEnd
        case 'ended':
        case '3':
          return status === LeaseStatus.Ended
        default:
          return false
      }
    })
  })
}

/**
 * Filter leases by date ranges
 */
const filterByDateRanges = (
  leases: TenfastLease[],
  params: leasing.v1.LeaseSearchQueryParams
): TenfastLease[] => {
  return leases.filter((lease) => {
    if (params.startDateFrom) {
      const fromDate = new Date(params.startDateFrom)
      if (lease.startDate < fromDate) return false
    }

    if (params.startDateTo) {
      const toDate = new Date(params.startDateTo)
      if (lease.startDate > toDate) return false
    }

    if (params.endDateFrom && lease.endDate) {
      const fromDate = new Date(params.endDateFrom)
      if (lease.endDate < fromDate) return false
    }

    if (params.endDateTo && lease.endDate) {
      const toDate = new Date(params.endDateTo)
      if (lease.endDate > toDate) return false
    }

    return true
  })
}

/**
 * Filter leases by text search (q parameter)
 * Searches in: leaseId, tenant names, tenant contact codes, address
 */
const filterByTextSearch = (
  leases: TenfastLease[],
  searchTerm: string | undefined
): TenfastLease[] => {
  if (!searchTerm) {
    return leases
  }

  const normalizedSearch = searchTerm.toLowerCase().trim()

  return leases.filter((lease) => {
    // Search in lease ID
    if (lease.externalId.toLowerCase().includes(normalizedSearch)) {
      return true
    }

    // Search in tenant names and contact codes
    for (const tenant of lease.hyresgaster) {
      const fullName = `${tenant.name.first} ${tenant.name.last}`.toLowerCase()
      if (fullName.includes(normalizedSearch)) {
        return true
      }
      if (tenant.displayName?.toLowerCase().includes(normalizedSearch)) {
        return true
      }
      if (tenant.externalId.toLowerCase().includes(normalizedSearch)) {
        return true
      }
      if (tenant.idbeteckning?.toLowerCase().includes(normalizedSearch)) {
        return true
      }
    }

    // Search in rental object address
    for (const rentalObject of lease.hyresobjekt) {
      if (rentalObject.postadress?.toLowerCase().includes(normalizedSearch)) {
        return true
      }
    }

    return false
  })
}

/**
 * Sort leases by specified field
 */
const sortLeases = (
  leases: TenfastLease[],
  sortBy: string | undefined,
  sortOrder: string | undefined
): TenfastLease[] => {
  const field = sortBy || 'leaseStartDate'
  const order = sortOrder || 'desc'

  return [...leases].sort((a, b) => {
    let comparison = 0

    switch (field) {
      case 'leaseStartDate':
        comparison = a.startDate.getTime() - b.startDate.getTime()
        break
      case 'lastDebitDate': {
        const aEnd = a.endDate?.getTime() || 0
        const bEnd = b.endDate?.getTime() || 0
        comparison = aEnd - bEnd
        break
      }
      case 'leaseId':
        comparison = a.externalId.localeCompare(b.externalId)
        break
      default:
        comparison = a.startDate.getTime() - b.startDate.getTime()
    }

    return order === 'asc' ? comparison : -comparison
  })
}

/**
 * Paginate results
 */
const paginateResults = <T>(
  items: T[],
  page: number,
  limit: number
): { content: T[]; totalRecords: number; page: number; limit: number } => {
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit

  return {
    content: items.slice(startIndex, endIndex),
    totalRecords: items.length,
    page,
    limit,
  }
}

/**
 * Fetch all leases from TenFAST with populated data
 */
const fetchAllLeases = async (): Promise<TenfastLease[]> => {
  try {
    // TenFAST API for fetching leases with populated tenant and rental object data
    const response = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal?hyresvard=${tenfastCompanyId}&populate=hyresobjekt,hyresgaster`,
    })

    if (response.status !== 200) {
      logger.error(
        { status: response.status, data: response.data },
        'Failed to fetch leases from TenFAST'
      )
      throw new Error('Failed to fetch leases from TenFAST')
    }

    // TenFAST returns an array of leases or { records: [...] }
    const data = response.data.records ?? response.data

    const parsed = TenfastLeaseSchema.array().safeParse(data)

    if (!parsed.success) {
      logger.error(
        { error: JSON.stringify(parsed.error, null, 2) },
        'Failed to parse TenFAST lease response'
      )
      throw new Error('Failed to parse TenFAST lease response')
    }

    return parsed.data
  } catch (err) {
    logger.error({ error: err }, 'Error fetching leases from TenFAST')
    throw err
  }
}

/**
 * Search leases from TenFAST with filtering and pagination
 *
 * Note: TenFAST API doesn't support server-side filtering/pagination for lease search,
 * so we fetch all leases and filter/paginate client-side.
 * This approach may need optimization for large datasets.
 */
export const searchLeases = async (
  params: leasing.v1.LeaseSearchQueryParams,
  _ctx: Context
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  // Fetch all leases from TenFAST
  let leases = await fetchAllLeases()

  // Apply filters
  leases = filterByTextSearch(leases, params.q)
  leases = filterByStatus(leases, params.status)
  leases = filterByDateRanges(leases, params)

  // TODO: Add support for these filters when TenFAST provides the necessary data
  // - objectType filter (requires rental object type mapping)
  // - property filter
  // - buildingCodes filter
  // - areaCodes filter
  // - districtNames filter
  // - buildingManager filter

  // Sort results
  leases = sortLeases(leases, params.sortBy, params.sortOrder)

  // Paginate
  const page = params.page || 1
  const limit = params.limit || 20
  const paginated = paginateResults(leases, page, limit)

  // Transform to search result format
  const content = paginated.content.map(transformToSearchResult)

  return {
    content,
    _meta: {
      totalRecords: paginated.totalRecords,
      page: paginated.page,
      limit: paginated.limit,
      count: content.length,
    },
    _links: [],
  }
}
