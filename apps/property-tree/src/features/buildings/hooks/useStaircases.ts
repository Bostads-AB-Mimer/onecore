import { useQuery } from '@tanstack/react-query'

import { staircaseService } from '@/services/api/core'

export const useStaircases = (buildingCode: string, staircaseCode?: string) => {
  return useQuery({
    queryKey: ['staircases', buildingCode, staircaseCode],
    queryFn: () =>
      staircaseService.getByBuildingCode(buildingCode, staircaseCode),
  })
}
