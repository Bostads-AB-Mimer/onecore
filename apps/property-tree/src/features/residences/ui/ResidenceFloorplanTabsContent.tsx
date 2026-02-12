import { TabLayout } from '@/shared/ui/layout/TabLayout'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FileImage } from 'lucide-react'
import { useState } from 'react'

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
            src={`https://pub.mimer.nu/bofaktablad/bofaktablad/${rentalId}.jpg`}
            alt="Planritning"
            onError={() => setImageError(true)}
            className="max-w-full h-auto mx-auto"
          />
        </div>
      )}
    </TabLayout>
  )
}
