import { useMemo } from 'react'

import type { ComponentModel } from '@/services/types'

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

import type { SurfaceType } from '../constants'
import { useAddSurfaceComponent } from '../hooks/useAddSurfaceComponent'
import { useSurfaceModels } from '../hooks/useSurfaceModels'

interface AddSurfaceComponentMenuProps {
  propertyObjectId: string
  missingSurfaces: SurfaceType[]
}

// Real data has ~2,500 ComponentModels under Ytskikt across ~24 subtypes
// (~107 models per subtype on average). Showing one menu item per model is
// unusable, so the picker is grouped by subtype: one item per subtype, and
// clicking it installs a deterministic representative model.
interface SubtypeOption {
  subtypeId: string
  subtypeName: string
  representativeModelId: string
}

function pickRepresentativeModel(models: ComponentModel[]): ComponentModel {
  const subTypeName = models[0]?.subtype?.subTypeName ?? ''
  return (
    models.find((m) => m.modelName === subTypeName) ??
    [...models].sort((a, b) => a.modelName.localeCompare(b.modelName))[0]
  )
}

function groupSurfaceModels(
  models: ComponentModel[]
): Map<SurfaceType, SubtypeOption[]> {
  const bySubtype = new Map<string, ComponentModel[]>()
  for (const model of models) {
    const subtypeId = model.subtype?.id
    if (!subtypeId) continue
    const bucket = bySubtype.get(subtypeId)
    if (bucket) {
      bucket.push(model)
    } else {
      bySubtype.set(subtypeId, [model])
    }
  }

  const byType = new Map<SurfaceType, SubtypeOption[]>()
  for (const subtypeModels of bySubtype.values()) {
    const first = subtypeModels[0]
    const typeName = first.subtype?.componentType?.typeName as
      | SurfaceType
      | undefined
    const subtypeId = first.subtype?.id
    const subtypeName = first.subtype?.subTypeName
    if (!typeName || !subtypeId || !subtypeName) continue
    const representative = pickRepresentativeModel(subtypeModels)
    const options = byType.get(typeName) ?? []
    options.push({
      subtypeId,
      subtypeName,
      representativeModelId: representative.id,
    })
    byType.set(typeName, options)
  }

  for (const options of byType.values()) {
    options.sort((a, b) => a.subtypeName.localeCompare(b.subtypeName))
  }

  return byType
}

export function AddSurfaceComponentMenu({
  propertyObjectId,
  missingSurfaces,
}: AddSurfaceComponentMenuProps) {
  const { data: surfaceModels = [] } = useSurfaceModels()
  const addSurfaceComponent = useAddSurfaceComponent(propertyObjectId)

  const subtypesByType = useMemo(
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
        {missingSurfaces.map((typeName) => {
          const subtypes = subtypesByType.get(typeName) ?? []

          return (
            <DropdownMenuSub key={typeName}>
              <DropdownMenuSubTrigger>{typeName}</DropdownMenuSubTrigger>
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
