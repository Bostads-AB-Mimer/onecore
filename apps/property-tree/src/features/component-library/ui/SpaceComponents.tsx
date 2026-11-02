import { useState } from 'react'
import { Plus } from 'lucide-react'

import { useComponents } from '@/entities/component'

import { ComponentDetailsPanel } from './ComponentDetailsPanel'
import { ComponentInstallationDialog } from './ComponentInstallationDialog'

interface SpaceComponentsProps {
  spaceId: string
  spaceName: string
}

export const SpaceComponents = ({
  spaceId,
  spaceName,
}: SpaceComponentsProps) => {
  const [isInstallOpen, setIsInstallOpen] = useState(false)
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

  return (
    <>
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Komponenter
          {components.length > 0 && ` (${components.length})`}
        </p>
        <ul className="divide-y border-y">
          {components.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              Inga komponenter installerade ännu
            </li>
          )}
          {components.map((component) => (
            <li key={component.id}>
              <ComponentDetailsPanel component={component} spaceId={spaceId} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setIsInstallOpen(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Installera komponent
            </button>
          </li>
        </ul>
      </div>

      <ComponentInstallationDialog
        isOpen={isInstallOpen}
        onClose={() => setIsInstallOpen(false)}
        propertyObjectId={spaceId}
        spaceName={spaceName}
      />
    </>
  )
}
