import { useId, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface ImageDropzoneProps {
  onFiles: (files: File[]) => void
  acceptedTypes: readonly string[]
  maxBytes: number
  maxSizeLabel: string
  disabled?: boolean
  /** Explains a disabled dropzone, e.g. "Spara guiden först". */
  disabledReason?: string
  multiple?: boolean
  className?: string
}

/**
 * Drag-and-drop area with a file picker fallback. Validates type and size
 * before handing files on, and reports rejected files inline.
 */
export function ImageDropzone({
  onFiles,
  acceptedTypes,
  maxBytes,
  maxSizeLabel,
  disabled = false,
  disabledReason,
  multiple = true,
  className,
}: ImageDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return
    const files = Array.from(fileList)
    const rejected: string[] = []
    const accepted = files.filter((file) => {
      if (!acceptedTypes.includes(file.type)) {
        rejected.push(`${file.name}: fel filtyp (tillåtet: PNG, JPG, WEBP)`)
        return false
      }
      if (file.size > maxBytes) {
        rejected.push(`${file.name}: för stor (max ${maxSizeLabel})`)
        return false
      }
      return true
    })
    setError(rejected.length > 0 ? rejected.join('. ') : null)
    if (accepted.length > 0) onFiles(multiple ? accepted : accepted.slice(0, 1))
  }

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragOver(false)
          handleFiles(event.dataTransfer.files)
        }}
        title={disabled ? disabledReason : undefined}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-5 text-center text-sm transition-colors',
          isDragOver && 'border-primary bg-primary/5',
          disabled
            ? 'cursor-not-allowed border-muted text-muted-foreground opacity-70'
            : 'border-input text-muted-foreground hover:border-primary/60 hover:bg-muted/40'
        )}
      >
        <ImagePlus className="h-5 w-5" aria-hidden />
        {disabled && disabledReason ? (
          <span>{disabledReason}</span>
        ) : (
          <>
            <span>
              <span className="font-medium text-foreground">Välj bild</span>{' '}
              eller dra och släpp här
            </span>
            <span className="text-xs">
              PNG, JPG eller WEBP, max {maxSizeLabel}
            </span>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files)
            // Allow picking the same file again after removing it.
            event.target.value = ''
          }}
        />
      </label>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
