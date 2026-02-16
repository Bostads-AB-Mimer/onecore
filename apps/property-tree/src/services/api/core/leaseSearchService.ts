import type { components } from './generated/api-types'
import { GET } from './base-api'

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
  status?: ('0' | '1' | '2' | '3')[]
  startDateFrom?: string
  startDateTo?: string
  endDateFrom?: string
  endDateTo?: string
  property?: string[]
  buildingCodes?: string[]
  areaCodes?: string[]
  districtNames?: string[]
  buildingManager?: string[]
  sortBy?: 'leaseStartDate' | 'lastDebitDate' | 'leaseId'
  sortOrder?: 'asc' | 'desc'
}

export type ContactInfo = {
  contactCode: string
  name: string
  phone: string | null
  email: string | null
}

async function search(
  params: LeaseSearchQueryParams,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<LeaseSearchResult>> {
  const { data, error } = await GET('/leases/search', {
    params: {
      query: {
        ...params,
        page,
        limit,
      },
    },
  })

  if (error) throw error

  const response = data as {
    content?: LeaseSearchResult[]
    _meta?: PaginationMeta
    _links?: PaginationLinks[]
  }

  return {
    content: response.content ?? [],
    _meta: response._meta!,
    _links: response._links ?? [],
  }
}

export type BuildingManager = {
  code: string
  name: string
  district: string
}

async function getBuildingManagers(): Promise<BuildingManager[]> {
  const { data, error } = await GET('/leases/building-managers', {})

  if (error) throw error

  const response = data as { content?: BuildingManager[] }
  return response.content ?? []
}

async function getContactsByFilters(
  params: LeaseSearchQueryParams
): Promise<ContactInfo[]> {
  const { data, error } = await GET('/leases/contacts-by-filters' as any, {
    params: {
      query: params,
    },
  })

  if (error) throw error

  const response = data as { content?: ContactInfo[] }
  return response.content ?? []
}

async function exportLeasesToExcel(
  params: LeaseSearchQueryParams
): Promise<Blob> {
  const { data, error } = await GET('/leases/export', {
    params: { query: params },
    parseAs: 'blob',
  })

  if (error) throw error
  return data as Blob
}

export const leaseSearchService = {
  search,
  getBuildingManagers,
  getContactsByFilters,
  exportLeasesToExcel,
}
