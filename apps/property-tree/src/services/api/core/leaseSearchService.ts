import { resolve } from '@/shared/lib/env'

import { GET } from './baseApi'
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
  name?: string
  objectType?: string[]
  status?: (
    | 'current'
    | 'upcoming'
    | 'abouttoend'
    | 'ended'
    | 'preliminaryterminated'
    | 'pendingsignature'
    | 'notsent'
  )[]
  leaseType?: string[]
  parkingSpaceType?: string[]
  startDateFrom?: string
  startDateTo?: string
  endDateFrom?: string
  endDateTo?: string
  property?: string[]
  buildingCodes?: string[]
  areaCodes?: string[]
  districtNames?: string[]
  buildingManager?: string[]
  sortBy?:
    | 'leaseStartDate'
    | 'lastDebitDate'
    | 'leaseId'
    | 'address'
    | 'objectType'
    | 'rentalObjectCode'
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

export type ParkingSpaceType = {
  code: string
  caption: string
}

async function getParkingSpaceTypes(): Promise<ParkingSpaceType[]> {
  const { data, error } = await GET('/leases/parking-space-types', {})

  if (error) throw error

  return (data.content ?? []).map((pt) => ({
    code: pt.code ?? '',
    caption: pt.caption ?? '',
  }))
}

async function getContactsByFilters(
  params: LeaseSearchQueryParams
): Promise<ContactInfo[]> {
  const { data, error } = await GET('/contacts/from-lease-search', {
    params: {
      query: params as any,
    },
  })

  if (error) throw error

  return data.content ?? []
}

async function exportLeasesToExcel(
  params: LeaseSearchQueryParams
): Promise<Blob> {
  const baseUrl = resolve('VITE_CORE_API_URL', 'http://localhost:5010')
  const queryParams = new URLSearchParams()

  if (params.q) queryParams.set('q', params.q)
  if (params.sortBy) queryParams.set('sortBy', params.sortBy)
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder)
  if (params.startDateFrom) queryParams.set('startDateFrom', params.startDateFrom)
  if (params.startDateTo) queryParams.set('startDateTo', params.startDateTo)
  if (params.endDateFrom) queryParams.set('endDateFrom', params.endDateFrom)
  if (params.endDateTo) queryParams.set('endDateTo', params.endDateTo)
  for (const v of params.objectType ?? []) queryParams.append('objectType', v)
  for (const v of params.status ?? []) queryParams.append('status', v)
  for (const v of params.property ?? []) queryParams.append('property', v)
  for (const v of params.buildingCodes ?? []) queryParams.append('buildingCodes', v)
  for (const v of params.areaCodes ?? []) queryParams.append('areaCodes', v)
  for (const v of params.districtNames ?? []) queryParams.append('districtNames', v)
  for (const v of params.buildingManager ?? []) queryParams.append('buildingManager', v)

  const response = await fetch(`${baseUrl}/leases/export?${queryParams}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`)
  }

  return response.blob()
}

export const leaseSearchService = {
  search,
  getBuildingManagers,
  getParkingSpaceTypes,
  getContactsByFilters,
  exportLeasesToExcel,
}
