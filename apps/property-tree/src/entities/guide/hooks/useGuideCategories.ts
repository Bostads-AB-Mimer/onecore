import { useQuery } from '@tanstack/react-query'

import { guideService } from '@/services/api/core'

import { guideQueryKeys } from './useGuides'

export function useGuideCategories() {
  return useQuery({
    queryKey: guideQueryKeys.categories,
    queryFn: () => guideService.getCategories(),
  })
}
