import { useEffect } from 'react'
import { inspectionService } from '@/services/api/core/inspectionService'
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { InspectionStatusFilter } from '../constants/inspectionTypes'

export function useInspections(
  statusFilter: InspectionStatusFilter,
  page = 1,
  limit = 25,
  inspector?: string,
  address?: string
) {
  const queryClient = useQueryClient()

  const inspectionsQuery = useQuery({
    queryKey: ['inspections', statusFilter, page, limit, inspector, address],
    queryFn: () =>
      inspectionService.getAllInspections({
        page,
        limit,
        statusFilter,
        inspector: inspector || undefined,
        address: address || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  // Prefetch next page for instant navigation
  useEffect(() => {
    const totalRecords = inspectionsQuery.data?._meta?.totalRecords ?? 0
    const totalPages = Math.ceil(totalRecords / limit)

    if (page < totalPages) {
      queryClient.prefetchQuery({
        queryKey: [
          'inspections',
          statusFilter,
          page + 1,
          limit,
          inspector,
          address,
        ],
        queryFn: () =>
          inspectionService.getAllInspections({
            page: page + 1,
            limit,
            statusFilter,
            inspector: inspector || undefined,
            address: address || undefined,
          }),
      })
    }
  }, [
    page,
    limit,
    statusFilter,
    inspector,
    address,
    queryClient,
    inspectionsQuery.data?._meta?.totalRecords,
  ])

  return {
    data: inspectionsQuery.data?.content,
    meta: inspectionsQuery.data?._meta,
    isLoading: inspectionsQuery.isLoading,
    isFetching: inspectionsQuery.isFetching,
    error: inspectionsQuery.error,
  }
}
