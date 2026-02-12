import { useQuery } from '@tanstack/react-query'

import { buildingService } from '@/services/api/core'

export function useBuilding(buildingId: string | undefined) {
  return useQuery({
    queryKey: ['building', buildingId],
    queryFn: () => buildingService.getById(buildingId!),
    enabled: !!buildingId,
  })
}
