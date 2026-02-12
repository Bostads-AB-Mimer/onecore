import { useQuery } from '@tanstack/react-query'

import { staircaseService } from '@/services/api/core'

export const useStaircases = (buildingCode: string) => {
  return useQuery({
    queryKey: ['staircases', buildingCode],
    queryFn: () => staircaseService.getByBuildingCode(buildingCode),
  })
}
