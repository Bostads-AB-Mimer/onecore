import { useState } from 'react'
import { Download, Printer } from 'lucide-react'

import { downloadFloorplan, printFloorplan } from '@/shared/lib/floorplan'
import { Button } from '@/shared/ui/Button'
import { FloorplanImage } from '@/shared/ui/FloorplanImage'
import { TabLayout } from '@/shared/ui/layout/TabLayout'

export const ResidenceFloorplanTabsContent = ({
  rentalId,
}: {
  rentalId: string
}) => {
  // Tracks which rentalId's image has loaded, so the buttons hide again
  // while a newly selected residence's floorplan is loading or missing.
  const [loadedRentalId, setLoadedRentalId] = useState<string | null>(null)
  const isLoaded = loadedRentalId === rentalId
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadFloorplan(rentalId)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <TabLayout title="Bofaktablad">
      {isLoaded && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => printFloorplan(rentalId)}
          >
            <Printer />
            Skriv ut
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download />
            Spara
          </Button>
        </div>
      )}
      <div className="text-center">
        <FloorplanImage
          key={rentalId}
          rentalId={rentalId}
          onLoad={() => setLoadedRentalId(rentalId)}
        />
      </div>
    </TabLayout>
  )
}
