import { useMutation, useQueryClient } from '@tanstack/react-query'

import { guideQueryKeys, type UpdateGuideRequest } from '@/entities/guide'

import { guideService } from '@/services/api/core'

export function useUpdateGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGuideRequest }) =>
      guideService.updateGuide(id, body),
    onSuccess: (guide) => {
      queryClient.setQueryData(guideQueryKeys.bySlug(guide.slug), guide)
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all })
    },
  })
}
