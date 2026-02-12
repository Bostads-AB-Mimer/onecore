import { useQuery } from '@tanstack/react-query'

import { maintenanceUnitService } from '@/services/api/core'

export function useMaintenanceUnit(code: string | undefined) {
  const query = useQuery({
    queryKey: ['maintenanceUnit', code],
    queryFn: () => maintenanceUnitService.getByCode(code!),
    enabled: !!code,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}
