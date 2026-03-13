import { useQuery } from '@tanstack/react-query'

import { buildingService, residenceService } from '@/services/api/core'
import { staircaseService } from '@/services/api/core/staircaseService'

export function useStaircaseDetails(
  buildingCode: string | undefined,
  staircaseCode: string | undefined
) {
  const buildingQuery = useQuery({
    queryKey: ['building', buildingCode],
    queryFn: () => buildingService.getByBuildingCode(buildingCode!),
    enabled: !!buildingCode,
  })

  const staircaseQuery = useQuery({
    queryKey: ['staircase', buildingCode, staircaseCode],
    queryFn: () =>
      staircaseService.getByBuildingCode(buildingCode!, staircaseCode!),
    enabled: !!buildingCode && !!staircaseCode,
  })

  const residencesQuery = useQuery({
    queryKey: ['residences', buildingCode],
    queryFn: () => residenceService.getByBuildingCode(buildingCode!),
    enabled: !!buildingCode,
  })

  return {
    building: buildingQuery.data,
    staircase: staircaseQuery.data?.[0],
    residences: residencesQuery.data,
    isLoading:
      buildingQuery.isLoading ||
      staircaseQuery.isLoading ||
      residencesQuery.isLoading,
    error: staircaseQuery.error || buildingQuery.error,
  }
}
