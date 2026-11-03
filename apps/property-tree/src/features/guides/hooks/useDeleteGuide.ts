import { useMutation, useQueryClient } from '@tanstack/react-query'

import { guideQueryKeys } from '@/entities/guide'

import { guideService } from '@/services/api/core'

export function useDeleteGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => guideService.deleteGuide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all })
    },
  })
}
