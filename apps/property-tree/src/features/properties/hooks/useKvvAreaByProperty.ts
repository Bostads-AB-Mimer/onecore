import { useQuery } from '@tanstack/react-query'

import { propertyService } from '@/services/api/core'

export function useKvvAreaByProperty(propertyCode: string | undefined) {
  return useQuery({
    queryKey: ['propertyKvvArea', propertyCode],
    queryFn: () => propertyService.getKvvArea(propertyCode!),
    enabled: !!propertyCode,
    staleTime: 5 * 60 * 1000,
  })
}
