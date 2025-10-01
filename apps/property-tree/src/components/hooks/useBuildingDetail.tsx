import { useQuery, useQueries } from '@tanstack/react-query'
import { Building, PropertyDetail } from '@/types/api'
import { buildingService } from '@/services/api'
import {
  propertyService,
  residenceService,
  staircaseService,
} from '@/services/api/core'
import { Residence, Staircase } from '@/services/types'

export const useBuildingDetail = (propertyId: string, buildingId?: string) => {
  const buildingQuery = useQuery({
    queryKey: ['building', buildingId],
    queryFn: () => buildingService.getById(buildingId!),
    enabled: !!buildingId,
  })

  const propertyQuery = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getPropertyById(propertyId),
    enabled: !!propertyId,
  })

  const residencesQuery = useQuery({
    queryKey: ['residences', buildingQuery.data?.code],
    queryFn: () => residenceService.getByBuildingCode(buildingQuery.data!.code),
    enabled: !!buildingQuery.data?.code,
  })

  const staircasesQuery = useQuery({
    queryKey: ['staircases', buildingQuery.data?.code],
    queryFn: () => staircaseService.getByBuildingCode(buildingQuery.data!.code),
    enabled: !!buildingQuery.data?.code,
  })

  const isLoading =
    buildingQuery.isLoading ||
    staircasesQuery.isLoading ||
    propertyQuery.isLoading ||
    residencesQuery.isLoading
  const error =
    buildingQuery.error ||
    staircasesQuery.error ||
    propertyQuery.error ||
    residencesQuery.error

  const building = buildingQuery.data
  const property = propertyQuery.data
  const staircases = staircasesQuery.data
  const residences = residencesQuery.data

  return {
    data: {
      building: building as Building,
      property: property as PropertyDetail,
      staircases: staircases as Staircase[],
      residences: residences as Residence[],
    },
    isLoading,
    error,
  }
}
