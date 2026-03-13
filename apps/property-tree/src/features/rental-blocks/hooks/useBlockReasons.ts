import { useQuery } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

export function useBlockReasons() {
  return useQuery({
    queryKey: ['blockReasons'],
    queryFn: () => residenceService.getBlockReasons(),
    staleTime: 1000 * 60 * 30, // 30 minutes - lookup data changes rarely
  })
}
