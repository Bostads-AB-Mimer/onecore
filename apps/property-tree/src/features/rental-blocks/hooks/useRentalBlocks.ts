import { useEffect } from 'react'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'
import type { RentalBlocksSearchParams } from '@/services/types'

const hasSearchFilters = (params: RentalBlocksSearchParams) =>
  Boolean(
    params.q ||
      params.kategori ||
      params.distrikt ||
      params.blockReason ||
      params.fastighet ||
      params.fromDateGte ||
      params.toDateLte
  )

const fetchRentalBlocks = (
  params: RentalBlocksSearchParams,
  page: number,
  limit: number
) =>
  hasSearchFilters(params)
    ? residenceService.searchRentalBlocks(params, page, limit)
    : residenceService.getAllRentalBlocks(params.active, page, limit)

export function useRentalBlocks(
  params: RentalBlocksSearchParams,
  page = 1,
  limit = 50
) {
  const queryClient = useQueryClient()

  const allRentalBlocksQuery = useQuery({
    queryKey: ['allRentalBlocks', params, page, limit],
    queryFn: () => fetchRentalBlocks(params, page, limit),
    placeholderData: keepPreviousData,
  })

  // Prefetch next page for instant navigation
  useEffect(() => {
    const totalRecords = allRentalBlocksQuery.data?._meta?.totalRecords ?? 0
    const totalPages = Math.ceil(totalRecords / limit)

    if (page < totalPages) {
      queryClient.prefetchQuery({
        queryKey: ['allRentalBlocks', params, page + 1, limit],
        queryFn: () => fetchRentalBlocks(params, page + 1, limit),
      })
    }
  }, [
    page,
    limit,
    params,
    queryClient,
    allRentalBlocksQuery.data?._meta?.totalRecords,
  ])

  return {
    data: allRentalBlocksQuery.data?.content,
    meta: allRentalBlocksQuery.data?._meta,
    isLoading: allRentalBlocksQuery.isLoading,
    isFetching: allRentalBlocksQuery.isFetching,
    error: allRentalBlocksQuery.error,
  }
}
