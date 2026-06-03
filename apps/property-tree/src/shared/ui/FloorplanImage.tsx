import { useState } from 'react'
import { FileImage } from 'lucide-react'

import { getFloorplanUrl } from '@/shared/lib/floorplan'
import { EmptyState } from '@/shared/ui/EmptyState'

interface FloorplanImageProps {
  rentalId?: string
  className?: string
}

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
