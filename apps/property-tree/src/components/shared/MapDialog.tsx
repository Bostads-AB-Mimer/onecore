import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Map } from '@/components/shared/Map'
import { Button } from '@/components/ui/Button'
import { MapIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { geocodingService } from '@/services/api/geocodingService'

interface MapDialogProps {
  residences: Array<{
    code: string
    name: string
    address: string
  }>
}

export function MapDialog({ residences }: MapDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const residenceAddresses = residences.map((r) => `${r.name}`).filter(Boolean)

  const { data: coordinates, isLoading } = useQuery({
    queryKey: ['coordinates', residenceAddresses],
    queryFn: async () => {
      const coords = await Promise.all(
        residenceAddresses.map((address) =>
          geocodingService.searchAddress(address)
        )
      )
      return coords.filter((coord): coord is [number, number] => coord !== null)
    },
    enabled: residenceAddresses.length > 0,
  })

  const locations = residences
    .map((residence, index) => {
      if (!coordinates?.[index]) return null
      const floor = parseInt(residence.code.split('-')[0])
      return {
        name: `LGH ${residence.code}`,
        coordinates: coordinates[index],
        floor,
        color: `hsl(${(floor * 30) % 360}, 70%, 50%)`,
      }
    })
    .filter((loc): loc is NonNullable<typeof loc> => loc !== null)

  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setIsOpen(true)}>
        <MapIcon className="h-4 w-4" />
      </Button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="sm:max-w-[800px]"
      >
        {locations.length > 0 ? (
          <Map locations={locations} center={locations[0].coordinates} />
        ) : (
          <div className="text-center py-4">
            {isLoading ? 'Loading...' : 'No locations available'}
          </div>
        )}
      </Dialog>
    </>
  )
}
