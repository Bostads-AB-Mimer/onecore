import { useRef } from 'react'
import { Camera, Loader2 } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'

import {
  type InspectionPhotoTarget,
  useInspectionPhotos,
} from '../hooks/useInspectionPhotos'

const MAX_WIDTH = 800
const JPEG_QUALITY = 0.7
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface InspectionPhotoUploadContext {
  inspectionId: string
  roomId: string
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
  const { toast } = useToast()
  const { uploadAsync, isUploading } = useInspectionPhotos(
    uploadContext.inspectionId
  )

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (event.target) event.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: 'Filtypen stöds inte',
        description: 'Använd JPEG, PNG eller WebP.',
        variant: 'destructive',
      })
      return
    }

    try {
      const compressed = await compressToJpegFile(file)
      const path = await uploadAsync({
        file: compressed,
        roomId: uploadContext.roomId,
        target: uploadContext.target,
      })
      onPhotoCaptured(path)
    } catch {
      toast({
        title: 'Kunde inte ladda upp foto',
        description: 'Försök igen om en stund.',
        variant: 'destructive',
      })
    }
  }

  const isDisabled = disabled || isUploading

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
    </div>
  )
}
