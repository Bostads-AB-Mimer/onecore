import { useQuery } from '@tanstack/react-query'

import { componentService } from '@/services/api/core/componentService'

const STALE_TIME = Infinity

export function useSurfaceModels() {
  return useQuery({
    queryKey: ['components', 'surface-models'],
    queryFn: () => componentService.getSurfaceModels(),
    staleTime: STALE_TIME,
  })
}
