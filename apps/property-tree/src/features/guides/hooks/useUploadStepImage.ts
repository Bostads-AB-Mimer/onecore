import { useMutation } from '@tanstack/react-query'

import { guideService } from '@/services/api/core'

import { fileToBase64 } from '@/shared/lib/file'

import { isGuideImageType } from '../lib/imageType'

interface UploadStepImageVariables {
  guideId: string
  stepId: string
  file: File
  /** Required by the server when the guide is published. */
  altText?: string
  caption?: string | null
  onProgress?: (fraction: number) => void
}

/** Upload one image to a saved step; the caller adds the result to state. */
export function useUploadStepImage() {
  return useMutation({
    mutationFn: async ({
      guideId,
      stepId,
      file,
      altText,
      caption,
      onProgress,
    }: UploadStepImageVariables) => {
      // Same error body core answers with, so the caller's message mapping
      // applies; no request is sent for a type core would refuse anyway.
      if (!isGuideImageType(file.type)) {
        throw { error: 'invalid-file-type' }
      }
      const fileData = await fileToBase64(file)
      return guideService.uploadStepImage(
        guideId,
        stepId,
        {
          fileName: file.name,
          fileData,
          contentType: file.type,
          altText,
          caption,
        },
        onProgress
      )
    },
  })
}
