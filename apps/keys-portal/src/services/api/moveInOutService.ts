import type { MoveInOutRow, PaginatedResponse } from '@/services/types'

import { ApiError, GET } from './core/base-api'

export type MoveInOutSortKey =
  'rentalObjectCode' | 'lastDebitDate' | 'leaseStartDate'

export interface MoveInOutQuery {
  endDateFrom?: string
  endDateTo?: string
  startDateFrom?: string
  startDateTo?: string
  q?: string
  sortBy?: MoveInOutSortKey
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export const moveInOutService = {
  async list(query: MoveInOutQuery): Promise<PaginatedResponse<MoveInOutRow>> {
    const { data, error, response } = await GET('/keys/move-in-out', {
      params: { query },
    })
    if (error) {
      // Status lets the page tell "syncing" (503) from a real error
      throw new ApiError(
        response.status,
        (error as { reason?: string }).reason ?? 'Request failed'
      )
    }
    return {
      content: data?.content ?? [],
      _meta: data?._meta ?? { totalRecords: 0, page: 1, limit: 100, count: 0 },
      _links: data?._links ?? [],
    }
  },
}
