import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'

interface PhotoCaptureProps {
  onPhotoCapture: (photoDataUrl: string) => void
  photoCount: number
  disabled?: boolean
}

export function PhotoCapture({
  onPhotoCapture,
  photoCount,
  disabled,
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Compress image to max 800px width
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const maxWidth = 800
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7)
        onPhotoCapture(compressedDataUrl)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be selected again
    if (event.target) event.target.value = ''
  }

  return (
    <div className="relative inline-block shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="h-10 w-10 shrink-0"
      >
        <Camera className="h-4 w-4" />
      </Button>
    </div>
  )
}
