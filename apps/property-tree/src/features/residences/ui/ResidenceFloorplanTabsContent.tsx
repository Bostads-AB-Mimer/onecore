import { useRef, useState } from 'react'
import { ExternalLink, Printer } from 'lucide-react'

import { getFloorplanUrl } from '@/shared/lib/floorplan'
import { printElement } from '@/shared/lib/print'
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
  const floorplanRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (floorplanRef.current) printElement(floorplanRef.current)
  }

  return (
    <TabLayout title="Bofaktablad">
      {isLoaded && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer />
            Skriv ut
          </Button>
          {/* A plain link rather than a download: the CDN sends no CORS
              headers, so the image can't be fetched and saved under a custom
              name. Users save it from the opened tab instead. */}
          <Button variant="outline" size="sm" asChild>
            <a
              href={getFloorplanUrl(rentalId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Öppna
            </a>
          </Button>
        </div>
      )}
      <div ref={floorplanRef} className="text-center">
        <FloorplanImage
          key={rentalId}
          rentalId={rentalId}
          onLoad={() => setLoadedRentalId(rentalId)}
        />
      </div>
    </TabLayout>
  )
}
