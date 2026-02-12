import { useQuery } from '@tanstack/react-query'

import { buildingService, residenceService } from '@/services/api/core'
import { staircaseService } from '@/services/api/core/staircaseService'

export function useStaircaseDetails(
  buildingId: string | undefined,
  staircaseId: string | undefined
) {
  const buildingQuery = useQuery({
    queryKey: ['building', buildingId],
    queryFn: () => buildingService.getById(buildingId!),
    enabled: !!buildingId,
  })

  const buildingCode = buildingQuery.data?.code

  const staircaseQuery = useQuery({
    queryKey: ['staircase', buildingId, staircaseId],
    queryFn: () =>
      staircaseService.getByBuildingCodeAndId(buildingCode!, staircaseId!),
    enabled: !!buildingCode && !!staircaseId,
  })

  const residencesQuery = useQuery({
    queryKey: ['residences', buildingCode],
    queryFn: () => residenceService.getByBuildingCode(buildingCode!),
    enabled: !!buildingCode,
  })

  return {
    building: buildingQuery.data,
    staircase: staircaseQuery.data,
    residences: residencesQuery.data,
    isLoading:
      buildingQuery.isLoading ||
      staircaseQuery.isLoading ||
      residencesQuery.isLoading,
    error: staircaseQuery.error || buildingQuery.error,
  }
}
