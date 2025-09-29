import { buildingService } from '@/services/api'
import { propertyService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'

export function usePropertyDetail(propertyId: string | undefined) {
  const propertyQuery = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getPropertyById(propertyId!),
    enabled: !!propertyId,
  })

  const buildingsQuery = useQuery({
    queryKey: ['buildings', propertyQuery.data?.code],
    queryFn: () => buildingService.getByPropertyCode(propertyQuery.data!.code),
    enabled: !!propertyQuery.data?.code,
  })

  const isLoading = propertyQuery.isLoading || buildingsQuery.isLoading
  const error = propertyQuery.error || buildingsQuery.error

  console.log(propertyQuery.data, buildingsQuery.data)

  return {
    data: {
      ...propertyQuery.data,
      buildings: buildingsQuery.data || [],
    },
    isLoading,
    error,
  }
}
