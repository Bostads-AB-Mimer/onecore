import type { components } from './generated/api-types'

export type LeaseSearchResult = components['schemas']['LeaseSearchResult']
export type PaginationMeta = components['schemas']['PaginationMeta']
export type PaginationLinks = components['schemas']['PaginationLinks']

export type PaginatedResponse<T> = {
  content: T[]
  _meta: PaginationMeta
  _links: PaginationLinks[]
}

export type LeaseSearchQueryParams = {
  q?: string
  objectType?: string[]
  status?: string[]
  startDateFrom?: string
  startDateTo?: string
  endDateFrom?: string
  endDateTo?: string
  property?: string[]
  buildingCodes?: string[]
  areaCodes?: string[]
  districtNames?: string[]
  buildingManagerCodes?: string[]
  sortBy?: 'leaseStartDate' | 'lastDebitDate' | 'leaseId'
  sortOrder?: 'asc' | 'desc'
}

async function search(
  params: LeaseSearchQueryParams,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<LeaseSearchResult>> {
  const searchParams = new URLSearchParams()

  if (params.q) searchParams.append('q', params.q)
  if (params.startDateFrom)
    searchParams.append('startDateFrom', params.startDateFrom)
  if (params.startDateTo)
    searchParams.append('startDateTo', params.startDateTo)
  if (params.endDateFrom)
    searchParams.append('endDateFrom', params.endDateFrom)
  if (params.endDateTo) searchParams.append('endDateTo', params.endDateTo)
  if (params.sortBy) searchParams.append('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder)

  params.objectType?.forEach((v) => searchParams.append('objectType', v))
  params.status?.forEach((v) => searchParams.append('status', v))
  params.property?.forEach((v) => searchParams.append('property', v))
  params.buildingCodes?.forEach((v) => searchParams.append('buildingCodes', v))
  params.areaCodes?.forEach((v) => searchParams.append('areaCodes', v))
  params.districtNames?.forEach((v) => searchParams.append('districtNames', v))
  params.buildingManagerCodes?.forEach((v) =>
    searchParams.append('buildingManagerCodes', v)
  )

  searchParams.append('page', String(page))
  searchParams.append('limit', String(limit))

  const response = await fetch(
    `${import.meta.env.VITE_CORE_API_URL || 'http://localhost:5010'}/leases/search?${searchParams.toString()}`,
    { credentials: 'include' }
  )

  if (!response.ok) {
    throw new Error(`Lease search failed: ${response.statusText}`)
  }

  return response.json()
}

export const leaseSearchService = { search }
