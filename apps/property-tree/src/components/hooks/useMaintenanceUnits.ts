import { maintenanceUnitService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import type { MaintenanceUnit } from '@/services/types'

export function useMaintenanceUnits(propertyCode: string | undefined): {
  maintenanceUnits: MaintenanceUnit[]
  isLoading: boolean
  error: Error | null
} {
  const maintenanceUnitsQuery = useQuery({
    queryKey: ['maintenanceUnits', propertyCode],
    queryFn: () => maintenanceUnitService.getByPropertyCode(propertyCode!),
    enabled: !!propertyCode,
  })

  return {
    maintenanceUnits: maintenanceUnitsQuery.data ?? [],
    isLoading: maintenanceUnitsQuery.isLoading,
    error: maintenanceUnitsQuery.error,
  }
}
