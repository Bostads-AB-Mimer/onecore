import { useEffect, useRef } from 'react'
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

export type { DispatchListItem, DispatchSearchQueryParams }

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

  // TODO: extract this prefetch into a shared usePrefetchAdjacentPage hook so
  // useLeaseSearch and other search pages can reuse it.
  const prev = useRef<{ paramsKey: string; page: number }>({
    paramsKey: JSON.stringify(params),
    page,
  })

  // Prefetch page+1. Immediate when paging within the same filters (fast
  // click-through stays snappy); debounced when the filters change (which also
  // resets the page) so rapid edits don't each fire a prefetch that's never
  // visited. keepPreviousData covers the filtering transition meanwhile.
  useEffect(() => {
    const paramsKey = JSON.stringify(params)
    const pagingOnly =
      prev.current.paramsKey === paramsKey && prev.current.page !== page
    prev.current = { paramsKey, page }

    const totalRecords = dispatchSearchQuery.data?._meta?.totalRecords ?? 0
    const totalPages = Math.ceil(totalRecords / limit)
    if (page >= totalPages) return

    const prefetch = () =>
      queryClient.prefetchQuery({
        queryKey: ['dispatchSearch', params, page + 1, limit],
        queryFn: () =>
          communicationService.searchDispatches(params, page + 1, limit),
      })

    if (pagingOnly) {
      prefetch()
      return
    }
    const timer = setTimeout(prefetch, 1000)
    return () => clearTimeout(timer)
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
