import { useQuery } from '@tanstack/react-query'

import { componentService } from '@/services/api/core/componentService'

const STALE_TIME = Infinity

export function useSurfaceSubtypes() {
  return useQuery({
    queryKey: ['component-subtypes', 'surface'],
    queryFn: () => componentService.getSurfaceSubtypes(),
    staleTime: STALE_TIME,
  })
}
