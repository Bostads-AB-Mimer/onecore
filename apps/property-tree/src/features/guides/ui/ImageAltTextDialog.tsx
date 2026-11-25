import { useEffect, useState } from 'react'

import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'

import { hasAltText } from '../lib/editorState'

export interface ImageWithAltText {
  file: File
  altText: string
}

interface ImageAltTextDialogProps {
  /** Files waiting for alt text; the dialog is open while this is non-empty. */
  files: File[]
  onConfirm: (images: ImageWithAltText[]) => void
  onCancel: () => void
}

/**
 * Asks for alt text before images are uploaded to a published guide. The
 * upload is visible to readers at once, so the server rejects images without
 * alt text there.
 */
export function ImageAltTextDialog({
  files,
  onConfirm,
  onCancel,
}: ImageAltTextDialogProps) {
  const [altTexts, setAltTexts] = useState<string[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  // Start from empty fields and fresh previews for each new batch of files.
  useEffect(() => {
    setAltTexts(files.map(() => ''))
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  const complete =
    altTexts.length === files.length && altTexts.every(hasAltText)

  const confirm = () => {
    if (!complete) return
    onConfirm(
      files.map((file, index) => ({ file, altText: altTexts[index].trim() }))
    )
  }

  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(open: boolean) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beskriv bilderna</DialogTitle>
          <DialogDescription>
            Guiden är publicerad och bilderna visas direkt för läsarna. Skriv en
            alt-text för varje bild innan den laddas upp.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
          {files.map((file, index) => {
            const inputId = `alt-text-upload-${index}`
            return (
              <li key={`${file.name}-${index}`} className="flex gap-3">
                <img
                  src={previews[index]}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded object-cover bg-muted"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Label htmlFor={inputId} className="truncate">
                    {file.name}
                  </Label>
                  <Input
                    id={inputId}
                    value={altTexts[index] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      setAltTexts((current) =>
                        current.map((text, i) => (i === index ? value : text))
                      )
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        confirm()
                      }
                    }}
                    placeholder="Alt-text (krävs)"
                    maxLength={500}
                    autoFocus={index === 0}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Avbryt
          </Button>
          <Button type="button" onClick={confirm} disabled={!complete}>
            {files.length === 1 ? 'Ladda upp bilden' : 'Ladda upp bilderna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
