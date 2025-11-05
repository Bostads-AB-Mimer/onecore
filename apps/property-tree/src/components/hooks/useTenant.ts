import { useQuery } from '@tanstack/react-query'
import { tenantService } from '@/services/api/core'

export function useTenant(contactCode: string | undefined) {
  const tenantQuery = useQuery({
    queryKey: ['tenant', contactCode],
    queryFn: () => tenantService.getByContactCode(contactCode!),
    enabled: !!contactCode,
  })

  const isLoading = tenantQuery.isLoading
  const error = tenantQuery.error

  return {
    data: tenantQuery.data,
    isLoading,
    error,
  }
}
