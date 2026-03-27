import { useQuery } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

export const useResidences = (buildingCode: string, enabled = true) => {
  return useQuery({
    queryKey: ['residences', buildingCode],
    queryFn: () => residenceService.getByBuildingCode(buildingCode),
    enabled: !!buildingCode && enabled,
  })
}
