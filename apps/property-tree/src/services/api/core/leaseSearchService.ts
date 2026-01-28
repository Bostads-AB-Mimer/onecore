import type { components } from './generated/api-types'
import { GET } from './base-api'
import { resolve } from '@/utils/env'

const CORE_API_URL = resolve('VITE_CORE_API_URL', 'http://localhost:5010')

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
  buildingManagerCodes?: string[]
  sortBy?: 'leaseStartDate' | 'lastDebitDate' | 'leaseId'
  sortOrder?: 'asc' | 'desc'
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

// Note: Using raw fetch instead of GET wrapper because this endpoint
// returns a binary Excel file (Blob), not JSON
async function exportLeasesToExcel(
  params: LeaseSearchQueryParams
): Promise<Blob> {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)))
    } else if (value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const response = await fetch(
    `${CORE_API_URL}/leases/export?${searchParams}`,
    { credentials: 'include' }
  )

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`)
  }

  return response.blob()
}

export const leaseSearchService = { search, exportLeasesToExcel }
