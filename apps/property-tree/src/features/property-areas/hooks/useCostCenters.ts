import { useQuery } from '@tanstack/react-query'

import { costCenterService } from '@/services/api/core'

export const useCostCenters = () => {
  return useQuery({
    queryKey: ['costCenters'],
    queryFn: () => costCenterService.getAll(),
  })
}
