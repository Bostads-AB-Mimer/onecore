import { useMutation } from '@tanstack/react-query'

import { guideService } from '@/services/api/core'

interface DeleteStepImageVariables {
  guideId: string
  imageId: string
}

/**
 * Delete one uploaded image. Images live on the server as soon as they are
 * uploaded, so removing one takes effect immediately; the caller drops it
 * from the editor state once this resolves.
 */
export function useDeleteStepImage() {
  return useMutation({
    mutationFn: ({ guideId, imageId }: DeleteStepImageVariables) =>
      guideService.deleteStepImage(guideId, imageId),
  })
}
