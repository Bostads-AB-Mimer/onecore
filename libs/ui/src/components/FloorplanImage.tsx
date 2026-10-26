import { useState } from 'react'
import { FileImage } from 'lucide-react'

import { getFloorplanUrl } from '../lib/floorplan'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../ui/Dialog'
import { EmptyState } from './EmptyState'

interface FloorplanImageProps {
  rentalId?: string
  className?: string
  /** Click to open the floorplan large in a dialog. */
  expandable?: boolean
}

/** A residence's floorplan, or an empty state when it has none published. */
export const FloorplanImage = ({
  rentalId,
  className,
  expandable = false,
}: FloorplanImageProps) => {
  const [imageError, setImageError] = useState(false)

  if (!rentalId || imageError) {
    return (
      <EmptyState
        icon={FileImage}
        title="Planritning inte tillgänglig"
        description="Planritning för denna lägenhet är inte tillgänglig för tillfället."
      />
    )
  }

  const src = getFloorplanUrl(rentalId)
  const image = (
    <img
      src={src}
      alt="Planritning"
      onError={() => setImageError(true)}
      className={className ?? 'max-w-full h-auto mx-auto'}
    />
  )

  if (!expandable) return image

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Visa planritningen i större format"
          className="flex h-full w-full cursor-zoom-in items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {image}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(90vw,72rem)]">
        <DialogTitle className="sr-only">Planritning</DialogTitle>
        <img
          src={src}
          alt="Planritning i större format"
          className="max-h-[85vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
