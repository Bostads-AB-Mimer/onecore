import { Card, CardContent } from '@/components/ui/v2/Card'
import { TabLayout } from '@/components/ui/TabLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { DoorOpen } from 'lucide-react'
import type { Building } from '@/types/api'

interface PropertyResidenceTabProps {
  buildings: Building[]
}

export const PropertyResidenceTab = ({
  buildings,
}: PropertyResidenceTabProps) => {
  // Count total entrances across all buildings
  const totalEntrances = buildings.reduce(
    (total, building) => total + (building.entrances?.length || 0),
    0
  )

  if (totalEntrances === 0) {
    return (
      <TabLayout title="Portar" count={0}>
        <EmptyState
          icon={DoorOpen}
          title="Inga portar"
          description="Det finns inga portar registrerade för denna fastighet ännu."
        />
      </TabLayout>
    )
  }

  return (
    <TabLayout title="Portar" count={totalEntrances} showCard={true}>
      {buildings.map(
        (building) =>
          building.entrances &&
          building.entrances.length > 0 && (
            <div key={building.id} className="space-y-4">
              <h3 className="text-lg font-semibold">{building.name}</h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {building.entrances.map((entrance) => (
                  <Card key={entrance.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-medium">
                            Port {entrance.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {entrance.apartments.length} lgh
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {building.name}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
      )}
    </TabLayout>
  )
}
