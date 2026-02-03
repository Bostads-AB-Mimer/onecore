import { maintenanceUnitService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import type { MaintenanceUnit } from '@/services/types'

export type MaintenanceUnitsContextType = 'property' | 'building' | 'residence'

interface UseMaintenanceUnitsOptions {
  contextType: MaintenanceUnitsContextType
  identifier: string | undefined
}

export function useMaintenanceUnits({
  contextType,
  identifier,
}: UseMaintenanceUnitsOptions): {
  maintenanceUnits: MaintenanceUnit[]
  isLoading: boolean
  error: Error | null
} {
  const maintenanceUnitsQuery = useQuery({
    queryKey: ['maintenanceUnits', contextType, identifier],
    queryFn: () => {
      switch (contextType) {
        case 'property':
          return maintenanceUnitService.getByPropertyCode(identifier!)
        case 'building':
          return maintenanceUnitService.getByBuildingCode(identifier!)
        case 'residence':
          return maintenanceUnitService.getByRentalId(identifier!)
      }
    },
    enabled: !!identifier,
  })

  return {
    maintenanceUnits: maintenanceUnitsQuery.data ?? [],
    isLoading: maintenanceUnitsQuery.isLoading,
    error: maintenanceUnitsQuery.error,
  }
}
