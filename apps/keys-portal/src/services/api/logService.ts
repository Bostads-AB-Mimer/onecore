// services/api/logService.ts
import type { Log, LogFilterParams, PaginatedResponse } from '@/services/types'

import { GET } from './core/base-api'

const mapFiltersToQuery = (
  filters?: LogFilterParams,
  page?: number,
  limit?: number
): Record<string, string> => {
  const q: Record<string, string> = {}
  if (!filters) return q

  // Pagination
  if (page) q.page = page.toString()
  if (limit) q.limit = limit.toString()

  // AND filters -> use DB column names
  if (filters.eventType?.length) q.eventType = filters.eventType.join(',')
  if (filters.objectType?.length) q.objectType = filters.objectType.join(',')
  if (filters.userName) q.userName = filters.userName

  // OR search -> DB column names in `fields`
  const free = (filters.q ?? '').trim()
  if (free.length >= 3) {
    q.q = free
    q.fields = 'userName,description,objectId' // Search in basic fields only (context fetched via JOINs)
  }
  return q
}

const asLog = (row: any): Log => row

export const logService = {
  async fetchLogs(
    filters?: LogFilterParams,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Log>> {
    const hasFree = (filters?.q ?? '').trim().length >= 3
    const hasFilters =
      !!filters?.eventType?.length ||
      !!filters?.objectType?.length ||
      !!filters?.userName ||
      hasFree

    const query = mapFiltersToQuery(filters, page, limit)

    const { data, error } = await GET(hasFilters ? '/logs/search' : '/logs', {
      params: { query }, // <-- required by openapi-fetch
    })
    if (error) throw error

    // Cast to any to access _meta since generated types don't include it yet
    const response = data as any
    const rows = (response?.content ?? []) as any[]
    const meta = response?._meta ?? {
      totalRecords: rows.length,
      page: 1,
      limit: rows.length,
      count: rows.length,
    }

    return {
      content: rows.map(asLog),
      _meta: {
        page: meta.page,
        limit: meta.limit,
        totalRecords: meta.totalRecords,
        count: meta.count,
      },
      _links: response?._links ?? [],
    }
  },

  async getUniqueUsers(): Promise<string[]> {
    const { data, error } = await GET('/logs/users', { params: {} })
    if (error) throw error
    return (data?.content ?? []) as string[]
  },

  async fetchLogsByObjectId(objectId: string): Promise<Log[]> {
    const { data, error } = await GET('/logs/object/{objectId}', {
      params: { path: { objectId } },
    })
    if (error) throw error
    const rows = (data?.content ?? []) as any[]
    return rows.map(asLog)
  },

  async fetchLogsByRentalObject(
    rentalObjectCode: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      eventType?: string
      objectType?: string
      userName?: string
    }
  ): Promise<PaginatedResponse<Log>> {
    const queryParams: Record<string, any> = { page, limit }

    // Add optional filters
    if (filters?.eventType) queryParams.eventType = filters.eventType
    if (filters?.objectType) queryParams.objectType = filters.objectType
    if (filters?.userName) queryParams.userName = filters.userName

    const { data, error } = await GET(
      '/logs/rental-object/{rentalObjectCode}',
      {
        params: {
          path: { rentalObjectCode },
          query: queryParams,
        },
      }
    )
    if (error) throw error

    const response = data as any
    const rows = (response?.content ?? []) as any[]
    const meta = response?._meta ?? {
      totalRecords: rows.length,
      page: 1,
      limit: rows.length,
      count: rows.length,
    }

    return {
      content: rows.map(asLog),
      _meta: {
        page: meta.page,
        limit: meta.limit,
        totalRecords: meta.totalRecords,
        count: meta.count,
      },
      _links: response?._links ?? [],
    }
  },

  async fetchLogsByContact(
    contactId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      eventType?: string
      objectType?: string
      userName?: string
    }
  ): Promise<PaginatedResponse<Log>> {
    const queryParams: Record<string, any> = { page, limit }

    // Add optional filters
    if (filters?.eventType) queryParams.eventType = filters.eventType
    if (filters?.objectType) queryParams.objectType = filters.objectType
    if (filters?.userName) queryParams.userName = filters.userName

    const { data, error } = await GET('/logs/contact/{contactId}', {
      params: {
        path: { contactId },
        query: queryParams,
      },
    })
    if (error) throw error

    const response = data as any
    const rows = (response?.content ?? []) as any[]
    const meta = response?._meta ?? {
      totalRecords: rows.length,
      page: 1,
      limit: rows.length,
      count: rows.length,
    }

    return {
      content: rows.map(asLog),
      _meta: {
        page: meta.page,
        limit: meta.limit,
        totalRecords: meta.totalRecords,
        count: meta.count,
      },
      _links: response?._links ?? [],
    }
  },
}
