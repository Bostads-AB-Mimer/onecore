import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateGuideRequest, guideQueryKeys } from '@/entities/guide'

import { guideService } from '@/services/api/core'

export function useCreateGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateGuideRequest) => guideService.createGuide(body),
    onSuccess: (guide) => {
      queryClient.setQueryData(guideQueryKeys.bySlug(guide.slug), guide)
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all })
    },
  })
}
