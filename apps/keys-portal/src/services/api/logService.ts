// services/api/logService.ts
import type { Log, LogFilterParams } from '@/services/types'

import { GET } from './core/base-api'

const mapFiltersToQuery = (
  filters?: LogFilterParams
): Record<string, string> => {
  const q: Record<string, string> = {}
  if (!filters) return q

  // AND filters -> use DB column names
  if (filters.eventType?.length) q.eventType = filters.eventType.join(',')
  if (filters.objectType?.length) q.objectType = filters.objectType.join(',')
  if (filters.userName) q.userName = filters.userName

  // OR search -> DB column names in `fields`
  const free = (filters.q ?? '').trim()
  if (free.length >= 3) {
    q.q = free
    q.fields = 'userName,description,objectId' // <-- IMPORTANT
  }
  return q
}

const normalizeLog = (row: any): Log => ({
  ...row,
  userName: row.userName,
  objectType: row.objectType,
  objectId: row.objectId ?? null,
  description: row.description ?? null,
})

export const logService = {
  async fetchLogs(filters?: LogFilterParams): Promise<Log[]> {
    const hasFree = (filters?.q ?? '').trim().length >= 3
    const hasFilters =
      !!filters?.eventType?.length ||
      !!filters?.objectType?.length ||
      !!filters?.userName ||
      hasFree

    const query = hasFilters ? mapFiltersToQuery(filters) : {}
    const { data, error } = await GET(hasFilters ? '/logs/search' : '/logs', {
      params: { query }, // <-- required by openapi-fetch
    })
    if (error) throw error

    const rows = (data?.content ?? []) as any[]
    return rows.map(normalizeLog)
  },

  async getUniqueUsers(): Promise<string[]> {
    const { data, error } = await GET('/logs', { params: {} })
    if (error) throw error
    const rows = (data?.content ?? []) as any[]
    const users = rows.map((r) => r.userName).filter(Boolean)
    return Array.from(new Set(users)).sort()
  },
}
