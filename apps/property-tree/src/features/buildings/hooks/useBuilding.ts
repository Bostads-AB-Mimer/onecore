import { useQuery } from '@tanstack/react-query'

import { buildingService } from '@/services/api/core'

export function useBuilding(buildingCode: string | undefined) {
  return useQuery({
    queryKey: ['building', buildingCode],
    queryFn: () => buildingService.getByBuildingCode(buildingCode!),
    enabled: !!buildingCode,
  })
}
