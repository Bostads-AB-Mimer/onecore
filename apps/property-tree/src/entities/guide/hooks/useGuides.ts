import { useQuery } from '@tanstack/react-query'

import { guideService } from '@/services/api/core'

export const guideQueryKeys = {
  all: ['guides'] as const,
  list: (includeDrafts: boolean) =>
    ['guides', 'list', { includeDrafts }] as const,
  bySlug: (slug: string) => ['guides', 'by-slug', slug] as const,
  byId: (id: string) => ['guides', 'by-id', id] as const,
  categories: ['guides', 'categories'] as const,
}

/** Guide summaries for the overview. Drafts are only returned to editors. */
export function useGuides(includeDrafts: boolean) {
  return useQuery({
    queryKey: guideQueryKeys.list(includeDrafts),
    queryFn: () => guideService.getGuides({ includeDrafts }),
  })
}
