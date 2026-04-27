import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui/Button'

import {
  type InspectionPhotoTarget,
  useInspectionPhotos,
} from '../hooks/useInspectionPhotos'

const MAX_WIDTH = 800
const JPEG_QUALITY = 0.7
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface InspectionPhotoUploadContext {
  inspectionId: string | undefined
  roomId: string
  roomName?: string | null
  target: InspectionPhotoTarget
}

interface PhotoCaptureProps {
  onPhotoCaptured: (path: string) => void
  uploadContext: InspectionPhotoUploadContext
  disabled?: boolean
}

function compressToJpegFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Image decode failed'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unsupported'))

        const scale = Math.min(1, MAX_WIDTH / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'))
            resolve(
              new File([blob], `photo-${Date.now()}.jpg`, {
                type: 'image/jpeg',
              })
            )
          },
          'image/jpeg',
          JPEG_QUALITY
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function PhotoCapture({
  onPhotoCaptured,
  uploadContext,
  disabled,
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { uploadAsync, isUploading } = useInspectionPhotos(
    uploadContext.inspectionId
  )

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return

    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Filtypen stöds inte')
      return
    }
    if (!uploadContext.inspectionId) {
      setError('Saknar besiktnings-id')
      return
    }

    try {
      const compressed = await compressToJpegFile(file)
      const path = await uploadAsync({
        file: compressed,
        roomId: uploadContext.roomId,
        roomName: uploadContext.roomName,
        target: uploadContext.target,
      })
      onPhotoCaptured(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda upp foto')
    }
  }

  const isDisabled = disabled || isUploading || !uploadContext.inspectionId

  return (
    <div className="relative inline-block shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={isDisabled}
        className="h-10 w-10 shrink-0"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </Button>
      {error && (
        <p className="absolute top-full mt-1 text-xs text-destructive whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  )
}
