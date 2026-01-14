import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react'
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
import { ComponentImageUpload } from './ComponentImageUpload'

interface ComponentImageGalleryProps {
  componentId: string
  isOpen: boolean
  onClose: () => void
}

export function ComponentImageGallery({
  componentId,
  isOpen,
  onClose,
}: ComponentImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Inline upload state for empty state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [uploadValidationError, setUploadValidationError] = useState<
    string | null
  >(null)

  const {
    images,
    isLoading,
    error,
    deleteImage,
    isDeleting,
    upload,
    isUploading,
    uploadError,
  } = useComponentImages(componentId)

  const currentImage = images?.[currentIndex]

  // Reset to first image when gallery opens or images change
  useEffect(() => {
    if (isOpen && images && images.length > 0) {
      setCurrentIndex(0)
    }
  }, [isOpen, images])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((i) => {
          if (!images) return i
          return Math.min(images.length - 1, i + 1)
        })
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, images, onClose])

  // Early return if modal is not open - AFTER all hooks
  if (!isOpen) {
    return null
  }

  // Navigation functions for button clicks
  const navigatePrev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }

  const navigateNext = () => {
    setCurrentIndex((i) => {
      if (!images) return i
      return Math.min(images.length - 1, i + 1)
    })
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // Inline upload handlers
  const validateAndSetUploadFile = (file: File) => {
    setUploadValidationError(null)

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setUploadValidationError(
        'Ogiltigt filformat. Vänligen ladda upp JPEG, PNG eller WebP'
      )
      return
    }

    // Check file size (50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadValidationError('Filen är för stor. Max storlek är 50MB')
      return
    }

    setUploadFile(file)
  }

  const handleUploadDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDragActive(true)
  }

  const handleUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDragActive(false)
  }

  const handleUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 1) {
      setUploadValidationError('Vänligen ladda upp en fil åt gången')
      return
    }

    validateAndSetUploadFile(files[0])
  }

  const handleUploadFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetUploadFile(selectedFile)
    }
  }

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setUploadValidationError('Välj en fil')
      return
    }

    upload(
      { file: uploadFile },
      {
        onSuccess: () => {
          // Reset form
          setUploadFile(null)
          setUploadValidationError(null)
        },
      }
    )
  }

  const handleDelete = () => {
    if (!currentImage) return

    if (deleteConfirm === currentImage.id) {
      // Actually delete - pass both documentId and fileId for proper cleanup
      deleteImage(
        { documentId: currentImage.id, fileId: currentImage.fileId },
        {
          onSuccess: () => {
            setDeleteConfirm(null)
            // If we deleted the last image in the list, go back one
            if (currentIndex >= images.length - 1 && currentIndex > 0) {
              setCurrentIndex(currentIndex - 1)
            }
          },
        }
      )
    } else {
      // Show confirmation
      setDeleteConfirm(currentImage.id)
      // Auto-cancel confirmation after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Komponentbilder</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">
              Laddar bilder...
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Error state
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Komponentbilder</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-red-600">
              Kunde inte ladda bilder. Försök igen.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Empty state - check this BEFORE currentImage check
  // Handle both empty array and undefined
  if (!images || images.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Komponentbilder</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag-drop zone */}
            <div
              onDrop={handleUploadDrop}
              onDragOver={handleUploadDragOver}
              onDragEnter={handleUploadDragEnter}
              onDragLeave={handleUploadDragLeave}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                uploadDragActive && 'border-primary bg-primary/5',
                !uploadDragActive &&
                  !uploadFile &&
                  'border-gray-300 hover:border-gray-400',
                uploadFile && 'bg-green-50 border-green-300'
              )}
              onClick={() =>
                document.getElementById('empty-file-input')?.click()
              }
            >
              <input
                id="empty-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUploadFileInputChange}
              />

              {uploadFile ? (
                <div>
                  <Check className="h-12 w-12 mx-auto text-green-600 mb-2" />
                  <p className="font-medium">{uploadFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(uploadFile.size)}
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="font-medium">
                    Dra bild hit eller klicka för att bläddra
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    JPEG, PNG, WebP • Max 50MB
                  </p>
                </div>
              )}
            </div>

            {uploadValidationError && (
              <p className="text-sm text-red-600">{uploadValidationError}</p>
            )}

            {uploadError && (
              <p className="text-sm text-red-600">
                Uppladdning misslyckades. Försök igen.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isUploading}>
              Avbryt
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={isUploading || !uploadFile}
            >
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

  // Safety check for currentImage - should not happen since we checked images.length above
  if (!currentImage) {
    console.error(
      'Unexpected state: images exist but currentImage is undefined',
      { currentIndex, imagesLength: images.length }
    )
    return null
  }

  // Gallery with images
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Komponentbilder ({images.length})</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Image viewer */}
            <div className="flex-1 relative bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImage.fileId}
                  src={currentImage.url}
                  alt={currentImage.originalName}
                  className="max-h-full max-w-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {/* Navigation buttons */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
                    onClick={navigatePrev}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
                    onClick={navigateNext}
                    disabled={currentIndex === images.length - 1}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Image counter */}
              <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded text-sm">
                {currentIndex + 1} / {images.length}
              </div>
            </div>

            {/* Image metadata */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {currentImage.originalName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(currentImage.size)} •{' '}
                  {formatDate(currentImage.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={
                    deleteConfirm === currentImage.id
                      ? 'destructive'
                      : 'outline'
                  }
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteConfirm === currentImage.id ? 'Bekräfta?' : ''}
                </Button>
              </div>
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.fileId}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      'flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all',
                      idx === currentIndex
                        ? 'border-primary ring-2 ring-primary ring-offset-2'
                        : 'border-transparent hover:border-gray-300'
                    )}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Ladda upp ny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComponentImageUpload
        componentId={componentId}
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </>
  )
}
