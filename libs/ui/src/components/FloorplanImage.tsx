import { useState } from 'react'
import { FileImage } from 'lucide-react'

import { getFloorplanUrl } from '../lib/floorplan'
import { EmptyState } from './EmptyState'

interface FloorplanImageProps {
  rentalId?: string
  className?: string
}

/** A residence's floorplan, or an empty state when it has none published. */
export const FloorplanImage = ({
  rentalId,
  className,
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

  return (
    <img
      src={getFloorplanUrl(rentalId)}
      alt="Planritning"
      onError={() => setImageError(true)}
      className={className ?? 'max-w-full h-auto mx-auto'}
    />
  )
}
