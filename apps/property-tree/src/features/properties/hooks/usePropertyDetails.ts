import { buildingService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import type { PropertyDetail } from '@/shared/types/api'
import { useProperty } from './useProperty'

export function usePropertyDetails(propertyId: string | undefined) {
  const propertyQuery = useProperty(propertyId)

  const buildingsQuery = useQuery({
    queryKey: ['buildings', propertyQuery.data?.code],
    queryFn: () => buildingService.getByPropertyCode(propertyQuery.data!.code),
    enabled: !!propertyQuery.data?.code,
  })

  const isLoading = propertyQuery.isLoading || buildingsQuery.isLoading
  const error = propertyQuery.error || buildingsQuery.error

  return {
    data: {
      ...propertyQuery.data,
      buildings: buildingsQuery.data || [],
    } as PropertyDetail | undefined,
    isLoading,
    error,
  }
}
