import { useQuery } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

// Finding the media takes one upstream request per file, and published files
// rarely change, so revisits within this window reuse the result.
const STALE_TIME_MS = 15 * 60 * 1000

export function useResidenceMedia(rentalId: string) {
  return useQuery({
    queryKey: ['residenceMedia', rentalId],
    queryFn: () => residenceService.getMedia(rentalId),
    staleTime: STALE_TIME_MS,
  })
}
