import { useEffect } from 'react'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  type LeaseSearchQueryParams,
  type LeaseSearchResult,
  leaseSearchService,
} from '@/services/api/core/leaseSearchService'

export type { LeaseSearchQueryParams, LeaseSearchResult }

export function useLeaseSearch(
  params: LeaseSearchQueryParams,
  page = 1,
  limit = 50
) {
  const queryClient = useQueryClient()

  const leaseSearchQuery = useQuery({
    queryKey: ['leaseSearch', params, page, limit],
    queryFn: () => leaseSearchService.search(params, page, limit),
    placeholderData: keepPreviousData,
  })

  // Prefetch next page for instant navigation
  // Skip prefetch for batch-get filters (district, buildingManager) as they are too heavy
  const hasBatchGetFilters = Boolean(
    params.districtNames?.length ||
      params.buildingManager?.length ||
      params.buildingCodes?.length ||
      params.areaCodes?.length
  )

  useEffect(() => {
    if (hasBatchGetFilters) return

    const totalRecords = leaseSearchQuery.data?._meta?.totalRecords ?? 0
    const totalPages = Math.ceil(totalRecords / limit)

    if (page < totalPages) {
      queryClient.prefetchQuery({
        queryKey: ['leaseSearch', params, page + 1, limit],
        queryFn: () => leaseSearchService.search(params, page + 1, limit),
      })
    }
  }, [
    page,
    limit,
    params,
    queryClient,
    hasBatchGetFilters,
    leaseSearchQuery.data?._meta?.totalRecords,
  ])

  const exportToExcel = (exportParams: LeaseSearchQueryParams) => {
    return leaseSearchService.exportLeasesToExcel(exportParams)
  }

  return {
    data: leaseSearchQuery.data?.content,
    meta: leaseSearchQuery.data?._meta,
    isLoading: leaseSearchQuery.isLoading,
    isFetching: leaseSearchQuery.isFetching,
    error: leaseSearchQuery.error,
    exportToExcel,
  }
}
