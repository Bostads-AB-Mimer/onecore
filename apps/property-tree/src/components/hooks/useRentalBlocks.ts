import { useEffect } from 'react'
import { residenceService } from '@/services/api/core'
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type { RentalBlocksSearchParams } from '@/services/types'

export type { RentalBlocksSearchParams }

export function useRentalBlocks(rentalId: string | undefined) {
  const rentalBlocksQuery = useQuery({
    queryKey: ['rentalBlocks', rentalId],
    queryFn: () => residenceService.getRentalBlocksByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const isLoading = rentalBlocksQuery.isLoading
  const error = rentalBlocksQuery.error

  return {
    data: rentalBlocksQuery.data,
    isLoading,
    error,
  }
}

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

export function useAllRentalBlocks(
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
