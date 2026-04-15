import { useState } from 'react'
import { FileImage } from 'lucide-react'

import { getFloorplanUrl } from '@/shared/lib/floorplan'
import { EmptyState } from '@/shared/ui/EmptyState'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

export const ResidenceFloorplanTabsContent = ({
  rentalId,
}: {
  rentalId: string
}) => {
  const [imageError, setImageError] = useState(false)

  return (
    <TabLayout title="Bofaktablad">
      {imageError ? (
        <EmptyState
          icon={FileImage}
          title="Planritning inte tillgänglig"
          description="Planritning för denna lägenhet är inte tillgänglig för tillfället."
        />
      ) : (
        <div className="text-center">
          <img
            src={getFloorplanUrl(rentalId)}
            alt="Planritning"
            onError={() => setImageError(true)}
            className="max-w-full h-auto mx-auto"
          />
        </div>
      )}
    </TabLayout>
  )
}
