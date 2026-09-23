import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { ImageDropzone } from '@/shared/ui/ImageDropzone'
import { Input } from '@/shared/ui/Input'
import { Progress } from '@/shared/ui/Progress'

import {
  GUIDE_IMAGE_MAX_BYTES,
  GUIDE_IMAGE_MAX_DISPLAY,
  GUIDE_IMAGE_TYPES,
} from '../constants'
import { useDeleteStepImage } from '../hooks/useDeleteStepImage'
import { useUploadStepImage } from '../hooks/useUploadStepImage'
import type { EditorAction, EditorStep } from '../lib/editorState'
import { uploadErrorMessage } from '../lib/errorMessages'

interface PendingUpload {
  key: string
  name: string
  progress: number
}

interface StepImageEditorProps {
  guideId: string | null
  step: EditorStep
  dispatch: React.Dispatch<EditorAction>
  /** Reports how many uploads this step currently has in flight. */
  onPendingChange: (stepId: string, count: number) => void
}

export function StepImageEditor({
  guideId,
  step,
  dispatch,
  onPendingChange,
}: StepImageEditorProps) {
  const { toast } = useToast()
  const upload = useUploadStepImage()
  const deleteImage = useDeleteStepImage()
  const [pending, setPending] = useState<PendingUpload[]>([])

  const canUpload = guideId !== null && step.saved

  // Keep the editor's total in sync, including the reset to zero when this
  // step unmounts while an upload is still running.
  useEffect(() => {
    onPendingChange(step.id, pending.length)
    return () => onPendingChange(step.id, 0)
  }, [onPendingChange, step.id, pending.length])

  const setProgress = (key: string, progress: number) =>
    setPending((current) =>
      current.map((item) => (item.key === key ? { ...item, progress } : item))
    )

  const handleFiles = (files: File[]) => {
    if (!guideId) return
    files.forEach((file) => {
      const key = `${file.name}-${Date.now()}-${Math.random()}`
      setPending((current) => [
        ...current,
        { key, name: file.name, progress: 0 },
      ])
      upload.mutate(
        {
          guideId,
          stepId: step.id,
          file,
          onProgress: (fraction) => setProgress(key, fraction),
        },
        {
          onSuccess: (image) =>
            dispatch({ type: 'add-image', stepId: step.id, image }),
          onError: (error) =>
            toast({
              title: 'Uppladdningen misslyckades',
              description: uploadErrorMessage(error, file.name),
              variant: 'destructive',
            }),
          onSettled: () =>
            setPending((current) => current.filter((item) => item.key !== key)),
        }
      )
    })
  }

  const removeImage = async (imageId: string) => {
    if (!guideId) return
    try {
      await deleteImage.mutateAsync({ guideId, imageId })
      dispatch({ type: 'remove-image', stepId: step.id, imageId })
    } catch {
      toast({
        title: 'Bilden kunde inte tas bort',
        description: 'Försök igen om en stund.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3">
      {step.images.length > 0 && (
        <ul className="space-y-3">
          {step.images.map((image, index) => (
            <li key={image.id} className="flex gap-3 rounded-md border p-2">
              <img
                src={image.url}
                alt={image.altText || image.filename}
                className="h-20 w-28 shrink-0 rounded object-cover bg-muted"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  value={image.altText}
                  onChange={(event) =>
                    dispatch({
                      type: 'update-image',
                      stepId: step.id,
                      imageId: image.id,
                      patch: { altText: event.target.value },
                    })
                  }
                  placeholder="Alt-text (krävs vid publicering)"
                  aria-label={`Alt-text för bild ${index + 1}`}
                  maxLength={500}
                />
                <Input
                  value={image.caption}
                  onChange={(event) =>
                    dispatch({
                      type: 'update-image',
                      stepId: step.id,
                      imageId: image.id,
                      patch: { caption: event.target.value },
                    })
                  }
                  placeholder="Bildtext (valfri)"
                  aria-label={`Bildtext för bild ${index + 1}`}
                  maxLength={500}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === 0}
                  onClick={() =>
                    dispatch({
                      type: 'move-image',
                      stepId: step.id,
                      from: index,
                      to: index - 1,
                    })
                  }
                  aria-label="Flytta bilden upp"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === step.images.length - 1}
                  onClick={() =>
                    dispatch({
                      type: 'move-image',
                      stepId: step.id,
                      from: index,
                      to: index + 1,
                    })
                  }
                  aria-label="Flytta bilden ned"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  disabled={deleteImage.isPending}
                  onClick={() => removeImage(image.id)}
                  aria-label="Ta bort bilden"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3" aria-live="polite">
        {pending.map((item) => (
          <div key={item.key} className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Laddar upp {item.name}...
            </p>
            <Progress value={Math.round(item.progress * 100)} />
          </div>
        ))}
      </div>

      <ImageDropzone
        onFiles={handleFiles}
        acceptedTypes={GUIDE_IMAGE_TYPES}
        maxBytes={GUIDE_IMAGE_MAX_BYTES}
        maxSizeLabel={GUIDE_IMAGE_MAX_DISPLAY}
        disabled={!canUpload}
        disabledReason="Spara guiden först för att kunna ladda upp bilder till steget."
        hint="Bilder sparas direkt när de laddas upp."
      />
    </div>
  )
}
