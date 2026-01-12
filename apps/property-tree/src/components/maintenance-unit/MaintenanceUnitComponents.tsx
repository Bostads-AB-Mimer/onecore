import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { componentService } from '@/services/api/core'
import { Button } from '../ui/v2/Button'
import { ComponentCard } from '../residence/ComponentCard'
import { ManageComponentsDialog } from '../residence/ManageRoomComponentsDialog'

interface MaintenanceUnitComponentsProps {
  propertyObjectId: string
  maintenanceUnitName?: string
}

export const MaintenanceUnitComponents = ({
  propertyObjectId,
  maintenanceUnitName,
}: MaintenanceUnitComponentsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const componentsQuery = useQuery({
    queryKey: ['components', propertyObjectId],
    queryFn: () => componentService.getByRoomId(propertyObjectId),
  })

  if (componentsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (componentsQuery.error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Kunde inte hämta komponenter</p>
      </div>
    )
  }

  const components = componentsQuery.data || []
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
              Inga komponenter installerade i denna serviceenhet
            </p>
          </div>
        )}
      </div>

      <ManageComponentsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        spaceId={propertyObjectId}
        spaceName={
          maintenanceUnitName
            ? `Serviceenhet: ${maintenanceUnitName}`
            : undefined
        }
      />
    </>
  )
}
