import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { guideQueryKeys, type GuideWithUrls } from '@/entities/guide'

import {
  type EditorAction,
  type PendingStepImages,
  type UploadedStepImage,
  withUploadedImages,
} from '../lib/editorState'
import { uploadErrorMessage } from '../lib/errorMessages'
import { useUploadStepImage } from './useUploadStepImage'

export interface PendingUploadResult {
  /** The saved guide including every image uploaded here. */
  guide: GuideWithUrls
  /** Images that failed; they stay pending on their step. */
  failed: number
}

/**
 * Uploads the images queued on steps that did not exist on the server until
 * the save that returned `guide`. Each step's images go one at a time in the
 * step's order, so the server appends them in that order. Every result is
 * dispatched as it arrives, and the cached guide is updated so an editor
 * remounted from the cache (after leaving /guider/ny) starts with the images.
 */
export function useUploadPendingImages(dispatch: React.Dispatch<EditorAction>) {
  const queryClient = useQueryClient()
  const { mutateAsync: uploadImage } = useUploadStepImage()
  const [isUploading, setIsUploading] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const uploadPendingImages = useCallback(
    async (
      guide: GuideWithUrls,
      pending: readonly PendingStepImages[]
    ): Promise<PendingUploadResult> => {
      if (pending.length === 0) return { guide, failed: 0 }

      setIsUploading(true)
      const uploaded: UploadedStepImage[] = []
      let failed = 0
      for (const { stepId, images } of pending) {
        for (const image of images) {
          // Leaving the editor abandons the rest; the files are gone with it.
          if (!mounted.current) break
          try {
            const result = await uploadImage({
              guideId: guide.id,
              stepId,
              file: image.file,
              altText: image.altText.trim() || undefined,
              caption: image.caption.trim() || null,
            })
            uploaded.push({ stepId, ...result })
            if (mounted.current) {
              dispatch({
                type: 'pending-image-uploaded',
                stepId,
                pendingId: image.id,
                image: result.image,
                guideUpdatedAt: result.guideUpdatedAt,
              })
            }
          } catch (error) {
            failed += 1
            if (mounted.current) {
              dispatch({
                type: 'pending-image-failed',
                stepId,
                pendingId: image.id,
                error: uploadErrorMessage(error, image.filename),
              })
            }
          }
        }
      }

      const updated = withUploadedImages(guide, uploaded)
      queryClient.setQueryData(guideQueryKeys.bySlug(updated.slug), updated)
      // The save's own invalidation may have started a refetch before these
      // uploads; its response would put the image-less guide back in the
      // cache. Invalidating again cancels it and fetches the final state.
      if (uploaded.length > 0) {
        queryClient.invalidateQueries({ queryKey: guideQueryKeys.all })
      }
      if (mounted.current) setIsUploading(false)
      return { guide: updated, failed }
    },
    [dispatch, queryClient, uploadImage]
  )

  return { uploadPendingImages, isUploading }
}
