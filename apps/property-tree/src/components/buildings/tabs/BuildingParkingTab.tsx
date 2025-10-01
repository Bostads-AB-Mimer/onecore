import { Card, CardContent } from '@/components/ui/v2/Card'
import { ComponentCard } from '@/components/ui/ComponentCard'
import { TabLayout } from '@/components/ui/TabLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Car } from 'lucide-react'
import type { Building } from '@/types/api'

interface BuildingParkingTabProps {
  building: Building
}

export const BuildingParkingTab = ({ building }: BuildingParkingTabProps) => {
  // Hitta parkering i spaces
  const parkingSpace = building.spaces?.find(
    (space) => space.name === 'Parkering'
  )
  const parking = parkingSpace?.components || []

  if (parking.length === 0) {
    return (
      <TabLayout title="Parkering" count={0}>
        <EmptyState
          icon={Car}
          title="Ingen parkering"
          description="Det finns inga parkeringsplatser registrerade för denna byggnad ännu."
        />
      </TabLayout>
    )
  }

  // Beräkna summor
  const totalSpaces = parking.reduce((sum, area) => {
    const spaces = parseInt(area.specs?.['Totalt platser'] || '0')
    return sum + spaces
  }, 0)

  const totalAvailable = parking.reduce((sum, area) => {
    const available = parseInt(area.specs?.['Lediga platser'] || '0')
    return sum + available
  }, 0)

  return (
    <TabLayout title="Parkering" count={totalSpaces} showCard={true}>
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold">{totalSpaces}</div>
          <p className="text-xs text-muted-foreground">Totalt antal platser</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {totalAvailable}
          </div>
          <p className="text-xs text-muted-foreground">Lediga platser</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {totalSpaces - totalAvailable}
          </div>
          <p className="text-xs text-muted-foreground">Upptagna platser</p>
        </div>
      </div>

      {/* Parking areas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {parking.map((area) => (
          <ComponentCard
            key={area.id}
            title={area.name}
            description={area.description}
            type={area.specs?.['Typ']}
            specs={
              area.specs
                ? Object.entries(area.specs)
                    .filter(([key]) => key !== 'Typ')
                    .map(([key, value]) => ({
                      label: key,
                      value: String(value),
                    }))
                : []
            }
          />
        ))}
      </div>
    </TabLayout>
  )
}
