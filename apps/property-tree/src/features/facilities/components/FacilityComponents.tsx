import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/v2/Button'
import { ComponentCard } from '@/components/residence/ComponentCard'
import { ManageComponentsDialog } from '@/components/residence/ManageRoomComponentsDialog'
import { useFacilityComponents } from '../hooks/useFacilityComponents'

interface FacilityComponentsProps {
  propertyObjectId: string
  facilityName?: string
}

export const FacilityComponents = ({
  propertyObjectId,
  facilityName,
}: FacilityComponentsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { components, isLoading, error } =
    useFacilityComponents(propertyObjectId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Kunde inte hämta komponenter</p>
      </div>
    )
  }

  const hasComponents = components.length > 0

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Komponenter {hasComponents && `(${components.length})`}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Lägg till/Ta bort komponent
          </Button>
        </div>

        {hasComponents ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {components.map((component) => (
              <ComponentCard key={component.id} component={component} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground">
              Inga komponenter installerade i denna lokal
            </p>
          </div>
        )}
      </div>

      <ManageComponentsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        spaceId={propertyObjectId}
        spaceName={facilityName ? `Lokal: ${facilityName}` : undefined}
      />
    </>
  )
}
