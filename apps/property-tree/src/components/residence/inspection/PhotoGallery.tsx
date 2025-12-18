import { useState } from 'react'
import { X, Plus, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { Dialog, DialogContent } from '@/components/ui/v2/Dialog'
import { PhotoCapture } from './PhotoCapture'

interface PhotoGalleryProps {
  photos: string[]
  onRemovePhoto: (index: number) => void
  onAddPhoto: (photoDataUrl: string) => void
}

export function PhotoGallery({
  photos,
  onRemovePhoto,
  onAddPhoto,
}: PhotoGalleryProps) {
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState<
    number | null
  >(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div key={index} className="relative aspect-square group">
            <img
              src={photo}
              alt={`Foto ${index + 1}`}
              className="w-full h-full object-cover rounded-lg border border-border cursor-pointer"
              onClick={() => setFullscreenPhotoIndex(index)}
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onRemovePhoto(index)
              }}
            >
              <X className="h-3 w-3" />
            </Button>
            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-4 w-4 text-white drop-shadow-lg" />
            </div>
          </div>
        ))}
        <div className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center">
          <PhotoCapture onPhotoCapture={onAddPhoto} photoCount={0} />
        </div>
      </div>

      {/* Fullscreen photo viewer */}
      <Dialog
        open={fullscreenPhotoIndex !== null}
        onOpenChange={() => setFullscreenPhotoIndex(null)}
      >
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          {fullscreenPhotoIndex !== null && (
            <div className="relative">
              <img
                src={photos[fullscreenPhotoIndex]}
                alt={`Foto ${fullscreenPhotoIndex + 1}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => {
                    onRemovePhoto(fullscreenPhotoIndex)
                    setFullscreenPhotoIndex(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {photos.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === fullscreenPhotoIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                      onClick={() => setFullscreenPhotoIndex(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
