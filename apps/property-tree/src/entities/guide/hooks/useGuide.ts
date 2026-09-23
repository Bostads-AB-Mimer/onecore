import { useQuery } from '@tanstack/react-query'

import { guideService } from '@/services/api/core'

import { guideQueryKeys } from './useGuides'

// Image urls in the response are presigned for 24 hours; keep the cache
// well inside that window.
const GUIDE_STALE_TIME_MS = 60 * 60 * 1000

/** A full guide by slug, or an unpublished notice for readers. */
export function useGuide(slug: string | undefined) {
  return useQuery({
    queryKey: guideQueryKeys.bySlug(slug ?? ''),
    queryFn: () => guideService.getGuideBySlug(slug ?? ''),
    enabled: Boolean(slug),
    staleTime: GUIDE_STALE_TIME_MS,
  })
}

/** A full guide by id, for the editor. */
export function useGuideById(id: string | undefined) {
  return useQuery({
    queryKey: guideQueryKeys.byId(id ?? ''),
    queryFn: () => guideService.getGuideById(id ?? ''),
    enabled: Boolean(id),
    staleTime: GUIDE_STALE_TIME_MS,
  })
}
