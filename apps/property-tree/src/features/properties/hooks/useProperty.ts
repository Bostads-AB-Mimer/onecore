import { useQuery } from '@tanstack/react-query'

import { propertyService } from '@/services/api/core'

export function useProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getPropertyById(propertyId!),
    enabled: !!propertyId,
  })
}
