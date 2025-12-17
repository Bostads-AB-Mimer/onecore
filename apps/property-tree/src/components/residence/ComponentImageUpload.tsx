import { useState } from 'react'
import { Upload, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import { cn } from '@/lib/utils'
import { useComponentImages } from '@/components/hooks/useComponentImages'

interface ComponentImageUploadProps {
  componentId: string
  isOpen: boolean
  onClose: () => void
}

export function ComponentImageUpload({
  componentId,
  isOpen,
  onClose,
}: ComponentImageUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { upload, isUploading, uploadError } = useComponentImages(componentId)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 1) {
      setValidationError('Vänligen ladda upp en fil åt gången')
      return
    }

    validateAndSetFile(files[0])
  }

  const validateAndSetFile = (file: File) => {
    setValidationError(null)

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setValidationError(
        'Ogiltigt filformat. Vänligen ladda upp JPEG, PNG eller WebP'
      )
      return
    }

    // Check file size (50MB - matches backend limit)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setValidationError(
        `Filen är för stor. Max storlek är ${Math.round(maxSize / 1024 / 1024)}MB`
      )
      return
    }

    setFile(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      setValidationError('Välj en fil')
      return
    }

    upload(
      { file },
      {
        onSuccess: () => {
          // Reset form and close modal
          setFile(null)
          setValidationError(null)
          onClose()
        },
      }
    )
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !isUploading) {
      // Reset form when closing
      setFile(null)
      setValidationError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ladda upp bild</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag-drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              dragActive && 'border-primary bg-primary/5',
              !dragActive && !file && 'border-gray-300 hover:border-gray-400',
              file && 'bg-green-50 border-green-300'
            )}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {file ? (
              <div>
                <Check className="h-12 w-12 mx-auto text-green-600 mb-2" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <p className="font-medium">
                  Dra bild hit eller klicka för att bläddra
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  JPEG, PNG, WebP • Max 10MB
                </p>
              </div>
            )}
          </div>

          {validationError && (
            <p className="text-sm text-red-600">{validationError}</p>
          )}

          {uploadError && (
            <p className="text-sm text-red-600">
              Uppladdning misslyckades. Försök igen.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || !file}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Laddar upp...
              </>
            ) : (
              'Ladda upp'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
