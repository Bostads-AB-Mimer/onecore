import { useEffect } from 'react'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  communicationService,
  type DispatchListItem,
  type DispatchSearchQueryParams,
} from '@/services/api/core/communicationService'

export type { DispatchListItem,DispatchSearchQueryParams }

export function useDispatchSearch(
  params: DispatchSearchQueryParams,
  page = 1,
  limit = 25
) {
  const queryClient = useQueryClient()

  const dispatchSearchQuery = useQuery({
    queryKey: ['dispatchSearch', params, page, limit],
    queryFn: () => communicationService.searchDispatches(params, page, limit),
    placeholderData: keepPreviousData,
  })

  // Prefetch next page for instant navigation
  useEffect(() => {
    const totalRecords = dispatchSearchQuery.data?._meta?.totalRecords ?? 0
    const totalPages = Math.ceil(totalRecords / limit)

    if (page < totalPages) {
      queryClient.prefetchQuery({
        queryKey: ['dispatchSearch', params, page + 1, limit],
        queryFn: () =>
          communicationService.searchDispatches(params, page + 1, limit),
      })
    }
  }, [
    page,
    limit,
    params,
    queryClient,
    dispatchSearchQuery.data?._meta?.totalRecords,
  ])

  return {
    data: dispatchSearchQuery.data?.content,
    meta: dispatchSearchQuery.data?._meta,
    isLoading: dispatchSearchQuery.isLoading,
    isFetching: dispatchSearchQuery.isFetching,
    error: dispatchSearchQuery.error,
  }
}
