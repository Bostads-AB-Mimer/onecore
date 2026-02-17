import { useQuery } from '@tanstack/react-query'

import { propertyService, staircaseService } from '@/services/api/core'
import { Building, Property } from '@/services/types'
import { Staircase } from '@/services/types'

import { useBuilding } from './useBuilding'

export const useBuildingDetails = (
  propertyCode: string,
  buildingCode?: string
) => {
  const buildingQuery = useBuilding(buildingCode)

  const propertyQuery = useQuery({
    queryKey: ['property', propertyCode],
    queryFn: () => propertyService.getPropertyByCode(propertyCode),
    enabled: !!propertyCode,
  })

  const staircasesQuery = useQuery({
    queryKey: ['staircases', buildingQuery.data?.code],
    queryFn: () => staircaseService.getByBuildingCode(buildingQuery.data!.code),
    enabled: !!buildingQuery.data?.code,
  })

  const isLoading =
    buildingQuery.isLoading ||
    staircasesQuery.isLoading ||
    propertyQuery.isLoading
  const error =
    buildingQuery.error || staircasesQuery.error || propertyQuery.error

  const building = buildingQuery.data
  const property = propertyQuery.data
  const staircases = staircasesQuery.data

  return {
    data: {
      building: building as Building,
      property: property as Property,
      staircases: staircases as Staircase[],
    },
    isLoading,
    error,
  }
}
