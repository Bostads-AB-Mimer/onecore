import { useQuery } from '@tanstack/react-query'

import { costCenterService } from '@/services/api/core'

export const useCostCenterTree = (id: string | undefined) => {
  return useQuery({
    queryKey: ['costCenterTree', id],
    queryFn: () => costCenterService.getTreeById(id as string),
    enabled: !!id,
  })
}
