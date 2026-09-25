import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ImageDropzone } from '@/shared/ui/ImageDropzone'
import { Input } from '@/shared/ui/Input'
import { Progress } from '@/shared/ui/Progress'

import {
  GUIDE_IMAGE_MAX_BYTES,
  GUIDE_IMAGE_MAX_DISPLAY,
  GUIDE_IMAGE_TYPES,
} from '../constants'
import type { StepImageRequests } from '../hooks/useStepImageRequests'
import type { EditorAction, EditorImage, EditorStep } from '../lib/editorState'
import { ImageAltTextDialog, type ImageWithAltText } from './ImageAltTextDialog'

interface PendingUpload {
  key: string
  name: string
  progress: number
}

interface StepImageEditorProps {
  guideId: string | null
  /**
   * True when the guide is published: an upload is visible to readers at
   * once, so alt text is collected before the upload instead of after it.
   */
  requireAltText: boolean
  step: EditorStep
  dispatch: React.Dispatch<EditorAction>
  /**
   * Immediate uploads and deletes. The editor owns them so they keep blocking
   * the save, and still reach its state, if this step is removed meanwhile.
   */
  imageRequests: StepImageRequests
  /**
   * True while the guide is being saved. A drop is not a form control the
   * fieldset can disable, and a file queued mid-save would miss the uploads.
   */
  disabled: boolean
}

export function StepImageEditor({
  guideId,
  requireAltText,
  step,
  dispatch,
  imageRequests,
  disabled,
}: StepImageEditorProps) {
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [awaitingAltText, setAwaitingAltText] = useState<File[]>([])
  // The requests outlive this step; its own progress state does not.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // The upload endpoint needs the guide and the step to exist on the server.
  // Until they do, dropped images are queued and uploaded after the save.
  const uploadsImmediately = guideId !== null && step.saved

  const setProgress = (key: string, progress: number) => {
    if (!mounted.current) return
    setPending((current) =>
      current.map((item) => (item.key === key ? { ...item, progress } : item))
    )
  }

  const setDeleting = (imageId: string, deleting: boolean) =>
    setDeletingIds((current) => {
      const next = new Set(current)
      if (deleting) next.add(imageId)
      else next.delete(imageId)
      return next
    })

  const handleFiles = (files: File[]) => {
    if (!uploadsImmediately) {
      // Alt text for queued images is edited inline; nothing is visible to
      // readers until the save, whose validation requires it when publishing.
      dispatch({
        type: 'add-pending-images',
        stepId: step.id,
        images: files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
        })),
      })
      return
    }
    if (requireAltText) {
      setAwaitingAltText(files)
      return
    }
    uploadImages(files.map((file) => ({ file, altText: '' })))
  }

  const uploadImages = (images: ImageWithAltText[]) => {
    if (!guideId) return
    images.forEach(async ({ file, altText }) => {
      const key = `${file.name}-${Date.now()}-${Math.random()}`
      setPending((current) => [
        ...current,
        { key, name: file.name, progress: 0 },
      ])
      await imageRequests.upload({
        guideId,
        stepId: step.id,
        file,
        altText,
        onProgress: (fraction) => setProgress(key, fraction),
      })
      if (mounted.current) {
        setPending((current) => current.filter((item) => item.key !== key))
      }
    })
  }

  const removeImage = async (image: EditorImage) => {
    if (image.kind === 'pending') {
      dispatch({
        type: 'remove-pending-image',
        stepId: step.id,
        imageId: image.id,
      })
      return
    }
    if (!guideId) return
    setDeleting(image.id, true)
    await imageRequests.remove({
      guideId,
      stepId: step.id,
      imageId: image.id,
    })
    if (mounted.current) setDeleting(image.id, false)
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
                {image.kind === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="px-2 py-0.5">
                      Laddas upp när guiden sparas
                    </Badge>
                    {image.error && (
                      <span className="text-xs text-destructive" role="alert">
                        {image.error}
                      </span>
                    )}
                  </div>
                )}
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
                  disabled={deletingIds.has(image.id)}
                  onClick={() => removeImage(image)}
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
        disabled={disabled}
        hint={
          !uploadsImmediately
            ? 'Bilderna laddas upp när du sparar guiden.'
            : requireAltText
              ? 'Bilder sparas och visas direkt när de laddas upp, så varje bild behöver en alt-text först.'
              : 'Bilder sparas direkt när de laddas upp.'
        }
      />

      <ImageAltTextDialog
        files={awaitingAltText}
        onConfirm={(images) => {
          setAwaitingAltText([])
          uploadImages(images)
        }}
        onCancel={() => setAwaitingAltText([])}
      />
    </div>
  )
}
