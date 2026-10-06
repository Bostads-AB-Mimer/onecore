import { useMemo } from 'react'

import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'

import type { SurfaceCode } from '../constants'
import { useAddSurfaceComponent } from '../hooks/useAddSurfaceComponent'
import { useSurfaceModels } from '../hooks/useSurfaceModels'
import { groupSurfaceModels, surfaceLabel } from '../lib/surfaces'

interface AddSurfaceComponentMenuProps {
  propertyObjectId: string
  missingSurfaces: SurfaceCode[]
}

export function AddSurfaceComponentMenu({
  propertyObjectId,
  missingSurfaces,
}: AddSurfaceComponentMenuProps) {
  const { data: surfaceModels = [] } = useSurfaceModels()
  const addSurfaceComponent = useAddSurfaceComponent(propertyObjectId)

  const groups = useMemo(
    () => groupSurfaceModels(surfaceModels),
    [surfaceModels]
  )

  if (missingSurfaces.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">+ Lägg till komponent</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {missingSurfaces.map((code) => {
          const subtypes = groups.get(code)?.subtypes ?? []

          return (
            <DropdownMenuSub key={code}>
              <DropdownMenuSubTrigger>
                {surfaceLabel(code, groups)}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {subtypes.map((option) => (
                  <DropdownMenuItem
                    key={option.subtypeId}
                    onClick={() =>
                      addSurfaceComponent.mutate(option.representativeModelId)
                    }
                  >
                    {option.subtypeName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
