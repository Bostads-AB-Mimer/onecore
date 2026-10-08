import { useQuery } from '@tanstack/react-query'

import { staircaseService } from '@/services/api/core'
import { Building, Staircase } from '@/services/types'

import { useBuilding } from './useBuilding'

export const useBuildingDetails = (buildingCode?: string) => {
  const buildingQuery = useBuilding(buildingCode)

  const staircasesQuery = useQuery({
    queryKey: ['staircases', buildingQuery.data?.code],
    queryFn: () => staircaseService.getByBuildingCode(buildingQuery.data!.code),
    enabled: !!buildingQuery.data?.code,
  })

  const isLoading = buildingQuery.isLoading || staircasesQuery.isLoading
  const error = buildingQuery.error || staircasesQuery.error

  return {
    data: {
      building: buildingQuery.data as Building,
      staircases: staircasesQuery.data as Staircase[],
    },
    isLoading,
    error,
  }
}
