import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/shared/hooks/useToast'

import type { EditorAction } from '../lib/editorState'
import { uploadErrorMessage } from '../lib/errorMessages'
import { useDeleteStepImage } from './useDeleteStepImage'
import { useUploadStepImage } from './useUploadStepImage'

export interface StepImageUpload {
  guideId: string
  stepId: string
  file: File
  altText?: string
  onProgress?: (fraction: number) => void
}

export interface StepImageDelete {
  guideId: string
  stepId: string
  imageId: string
}

export interface StepImageRequests {
  /** Upload an image to a saved step. Settles when the request does. */
  upload: (request: StepImageUpload) => Promise<void>
  /** Delete an uploaded image. Settles when the request does. */
  remove: (request: StepImageDelete) => Promise<void>
}

/**
 * Immediate image uploads and deletes on saved steps. Each one changes the
 * guide's updatedAt on the server, so a save sent while one is in flight
 * races it and gets a 409 or a stale updatedAt. Owned by the editor rather
 * than the step so that removing a step mid-request neither drops its result
 * (the reducer still records updatedAt for a missing step) nor unblocks saving
 * before the request settles.
 */
export function useStepImageRequests(dispatch: React.Dispatch<EditorAction>) {
  const { toast } = useToast()
  const { mutateAsync: uploadImage } = useUploadStepImage()
  const { mutateAsync: deleteImage } = useDeleteStepImage()
  const [inFlight, setInFlight] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Counts the request as in flight until it settles. Once the editor has
  // unmounted there is no state left to update.
  const track = useCallback(async (request: () => Promise<void>) => {
    setInFlight((count) => count + 1)
    try {
      await request()
    } finally {
      if (mounted.current) setInFlight((count) => count - 1)
    }
  }, [])

  const upload = useCallback(
    ({ guideId, stepId, file, altText, onProgress }: StepImageUpload) =>
      track(async () => {
        try {
          const { image, guideUpdatedAt } = await uploadImage({
            guideId,
            stepId,
            file,
            altText: altText || undefined,
            onProgress,
          })
          if (mounted.current) {
            dispatch({ type: 'add-image', stepId, image, guideUpdatedAt })
          }
        } catch (error) {
          if (mounted.current) {
            toast({
              title: 'Uppladdningen misslyckades',
              description: uploadErrorMessage(error, file.name),
              variant: 'destructive',
            })
          }
        }
      }),
    [dispatch, toast, track, uploadImage]
  )

  const remove = useCallback(
    ({ guideId, stepId, imageId }: StepImageDelete) =>
      track(async () => {
        try {
          const { guideUpdatedAt } = await deleteImage({ guideId, imageId })
          if (mounted.current) {
            dispatch({ type: 'remove-image', stepId, imageId, guideUpdatedAt })
          }
        } catch {
          if (mounted.current) {
            toast({
              title: 'Bilden kunde inte tas bort',
              description: 'Försök igen om en stund.',
              variant: 'destructive',
            })
          }
        }
      }),
    [deleteImage, dispatch, toast, track]
  )

  const requests = useMemo<StepImageRequests>(
    () => ({ upload, remove }),
    [upload, remove]
  )

  return { requests, inFlight }
}
