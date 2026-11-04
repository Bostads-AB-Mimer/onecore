import { useQuery } from '@tanstack/react-query'

import { leaseService } from '@/services/api/core'

export function useLeasesByContactCode(
  contactCode: string | undefined,
  { includeSubletLeases = false }: { includeSubletLeases?: boolean } = {}
) {
  const leasesQuery = useQuery({
    queryKey: ['leases', contactCode, { includeSubletLeases }],
    queryFn: () =>
      leaseService.getByContactCode(contactCode!, { includeSubletLeases }),
    enabled: !!contactCode,
  })

  const isLoading = leasesQuery.isLoading
  const error = leasesQuery.error

  return {
    data: leasesQuery.data,
    isLoading,
    error,
  }
}
