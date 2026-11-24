import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { ApiError } from '@/services/api/core/baseApi'
import {
  leaseRentRowService,
  type LeaseRentRowsQueryParams,
} from '@/services/api/core/leaseRentRowService'

export type LeaseRentRowsFilterParams = Omit<
  LeaseRentRowsQueryParams,
  'page' | 'limit'
>

const LEASE_RENT_ROWS_KEY = 'leaseRentRows'

export function useLeaseRentRows(
  params: LeaseRentRowsFilterParams,
  page: number,
  limit: number
) {
  const query = useQuery({
    queryKey: [LEASE_RENT_ROWS_KEY, params, page, limit],
    queryFn: () => leaseRentRowService.list(params, page, limit),
    placeholderData: keepPreviousData,
    // 503 means the lease list is still loading after a restart
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 503 && failureCount < 3,
    retryDelay: () => 30_000,
  })

  return {
    rows: query.data?.content ?? [],
    meta: query.data?._meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    failureCount: query.failureCount,
    failureReason: query.failureReason,
  }
}

export function useSetHomeInsuranceEndDate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (args: { leaseId: string; rowId: string; endDate: string }) =>
      leaseRentRowService.setHomeInsuranceEndDate(args.leaseId, {
        rowId: args.rowId,
        endDate: args.endDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEASE_RENT_ROWS_KEY] })
      // Lease views (by contact, by rental property) show rent rows too
      queryClient.invalidateQueries({ queryKey: ['leases'] })
    },
  })
}
