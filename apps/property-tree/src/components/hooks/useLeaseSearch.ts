import { useEffect } from 'react'
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import {
  leaseSearchService,
  type LeaseSearchQueryParams,
} from '@/services/api/core/leaseSearchService'

export type { LeaseSearchQueryParams }

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
  useEffect(() => {
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
    leaseSearchQuery.data?._meta?.totalRecords,
  ])

  return {
    data: leaseSearchQuery.data?.content,
    meta: leaseSearchQuery.data?._meta,
    isLoading: leaseSearchQuery.isLoading,
    isFetching: leaseSearchQuery.isFetching,
    error: leaseSearchQuery.error,
  }
}
