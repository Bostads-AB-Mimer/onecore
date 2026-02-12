import { useQuery } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

export const useResidences = (buildingCode: string) => {
  return useQuery({
    queryKey: ['residences', buildingCode],
    queryFn: () => residenceService.getByBuildingCode(buildingCode),
  })
}
