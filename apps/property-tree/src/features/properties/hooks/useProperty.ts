import { useQuery } from '@tanstack/react-query'

import { propertyService } from '@/services/api/core'

export function useProperty(propertyCode: string | undefined) {
  return useQuery({
    queryKey: ['property', propertyCode],
    queryFn: () => propertyService.getPropertyByCode(propertyCode!),
    enabled: !!propertyCode,
  })
}
