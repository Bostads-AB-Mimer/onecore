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

export type LeaseStatusFilter =
  | 'current'
  | 'upcoming'
  | 'abouttoend'
  | 'ended'
  | 'preliminaryterminated'
  | 'pendingsignature'
  | 'notsent'

export type LeaseSearchQueryParams = {
  q?: string
  name?: string
  objectType?: string[]
  status?: LeaseStatusFilter[]
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

  return {
    content: data.content ?? [],
    _meta: data._meta!,
    _links: data._links ?? [],
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

  return (data.content ?? []).map((bm) => ({
    code: bm.code ?? '',
    name: bm.name ?? '',
    district: bm.district ?? '',
  }))
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
      query: params,
    },
  })

  if (error) throw error

  return data.content ?? []
}

async function exportLeasesToExcel(
  params: LeaseSearchQueryParams
): Promise<Blob> {
  const { data, error } = await GET('/leases/export', {
    params: {
      query: params,
    },
    parseAs: 'blob',
  })

  if (error) throw error

  return data
}

async function getContactsByCodes(codes: string[]): Promise<ContactInfo[]> {
  if (codes.length === 0) return []

  const { data, error } = await GET('/v1/contacts/by-codes', {
    params: {
      query: { codes: codes.join(',') },
    },
  })

  if (error) return []

  return (data.content ?? []).map((c) => ({
    contactCode: c.contactCode,
    name: 'personal' in c ? c.personal.fullName : c.organisation.name,
    email: c.communication.emailAddresses[0]?.emailAddress ?? null,
    phone: c.communication.phoneNumbers[0]?.phoneNumber ?? null,
  }))
}

export const leaseSearchService = {
  search,
  getBuildingManagers,
  getParkingSpaceTypes,
  getContactsByCodes,
  getContactsByFilters,
  exportLeasesToExcel,
}
