import { useQuery } from '@tanstack/react-query'
import { leaseService } from '@/services/api/core'

export function useLeases(contactCode: string | undefined) {
  const leasesQuery = useQuery({
    queryKey: ['leases', contactCode],
    queryFn: () => leaseService.getByContactCode(contactCode!),
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
