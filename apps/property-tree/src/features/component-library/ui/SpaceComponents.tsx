import { useState } from 'react'
import { useComponents } from '@/entities/component'
import { ManageComponentsDialog } from './ManageComponentsDialog'
import { Button } from '@/shared/ui/Button'
import { Plus } from 'lucide-react'
import { ComponentDetailsPanel } from './ComponentDetailsPanel'

interface SpaceComponentsProps {
  spaceId: string
  spaceName: string
}

export const SpaceComponents = ({
  spaceId,
  spaceName,
}: SpaceComponentsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { components, isLoading, error } = useComponents(spaceId)

  if (isLoading) {
    return (
      <div className="py-4">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">
          Kunde inte hämta komponenter
        </p>
      </div>
    )
  }

  const hasComponents = components.length > 0

  return (
    <>
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">
            Komponenter
          </p>
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
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {components.map((component) => (
              <ComponentDetailsPanel key={component.id} component={component} />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              Inga komponenter installerade ännu
            </p>
          </div>
        )}
      </div>

      <ManageComponentsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        spaceId={spaceId}
        spaceName={spaceName}
      />
    </>
  )
}
