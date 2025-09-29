import type { Building } from '@/types/api'
import { Button } from '@/components/ui/v2/Button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { TabLayout } from '@/components/ui/TabLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Home } from 'lucide-react'

interface PropertyApartmentsTabProps {
  buildings: Building[]
}

export const PropertyApartmentsTab = ({
  buildings,
}: PropertyApartmentsTabProps) => {
  // Count total apartments across all buildings
  const totalApartments = buildings.reduce(
    (total, building) => total + (building.apartments?.length || 0),
    0
  )

  if (totalApartments === 0) {
    return (
      <TabLayout title="Lägenheter" count={0}>
        <EmptyState
          icon={Home}
          title="Inga lägenheter"
          description="Det finns inga lägenheter registrerade för denna fastighet ännu."
        />
      </TabLayout>
    )
  }

  return (
    <TabLayout title="Lägenheter" count={totalApartments} showCard={true}>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {buildings.flatMap((building) =>
          (building.apartments || []).map((apartment) => (
            <Card key={apartment.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{apartment.code}</CardTitle>
                  <span className="bg-muted text-muted-foreground text-xs font-medium px-2 py-1 rounded-full">
                    {apartment.size} m² • {apartment.rooms} rum
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{building.name}</p>
              </CardHeader>
              <CardContent className="flex justify-end pt-4">
                <Button variant="ghost" size="sm" className="h-7 w-7" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </TabLayout>
  )
}
