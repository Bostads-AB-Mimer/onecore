import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type LeaseExport,
  leaseExportService,
} from '@/services/api/core/leaseExportService'
import type { LeaseSearchQueryParams } from '@/services/api/core/leaseSearchService'

export async function downloadLeaseExport(exportId: string): Promise<void> {
  const url = await leaseExportService.getDownloadUrl(exportId)
  window.location.assign(url)
}

const LEASE_EXPORTS_KEY = ['leaseExports']

export function useLeaseExports() {
  const query = useQuery({
    queryKey: LEASE_EXPORTS_KEY,
    queryFn: () => leaseExportService.list(),
    refetchInterval: (q) =>
      q.state.data?.some((e) => e.status === 'running') ? 3000 : false,
  })

  const exports: LeaseExport[] = query.data ?? []

  return {
    exports,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    runningExport: exports.find((e) => e.status === 'running'),
  }
}

export function useStartLeaseExport() {
  const queryClient = useQueryClient()

  return useMutation<LeaseExport, Error, LeaseSearchQueryParams>({
    mutationFn: (params) => leaseExportService.start(params),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: LEASE_EXPORTS_KEY }),
  })
}
