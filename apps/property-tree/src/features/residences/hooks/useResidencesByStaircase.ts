import { useQuery } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

export const useResidencesByStaircase = (
  buildingCode?: string,
  staircaseCode?: string
) => {
  return useQuery({
    queryKey: ['residences', buildingCode, staircaseCode],
    queryFn: () =>
      residenceService.getByBuildingCodeAndStaircaseCode(
        buildingCode!,
        staircaseCode!
      ),
    enabled: !!buildingCode && !!staircaseCode,
  })
}
