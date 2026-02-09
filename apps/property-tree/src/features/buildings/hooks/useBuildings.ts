import { useQuery } from '@tanstack/react-query'
import { buildingService } from '@/services/api/core'

export const useBuildings = (propertyCode: string) => {
  return useQuery({
    queryKey: ['buildings', propertyCode],
    queryFn: () => buildingService.getByPropertyCode(propertyCode),
  })
}
