'use client'

import { useQueryClient } from '@tanstack/react-query'

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

import { componentService } from '@/services/api/core/componentService'
import type { SurfaceType } from '../constants'
import { useSurfaceModels } from '../hooks/useSurfaceModels'

interface AddSurfaceComponentMenuProps {
  propertyObjectId: string
  missingSurfaces: SurfaceType[]
}

export function AddSurfaceComponentMenu({
  propertyObjectId,
  missingSurfaces,
}: AddSurfaceComponentMenuProps) {
  const { data: surfaceModels = [] } = useSurfaceModels()
  const queryClient = useQueryClient()

  if (missingSurfaces.length === 0) {
    return null
  }

  const handleSubtypeSelect = async (modelId: string) => {
    try {
      await componentService.createInstanceWithInstallation(propertyObjectId, {
        modelId,
        installationDate: new Date().toISOString(),
        warrantyMonths: 0,
        priceAtPurchase: 0,
        depreciationPriceAtPurchase: 0,
        economicLifespan: 0,
        installationCost: 0,
      })

      await queryClient.invalidateQueries({
        queryKey: ['components', 'by-room', propertyObjectId],
      })
    } catch (error) {
      console.error('Failed to add surface component:', error)
    }
  }

  const getSubtypesByType = (typeName: SurfaceType) => {
    return surfaceModels.filter(
      (model) => model.subtype?.componentType?.typeName === typeName
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">+ Lägg till komponent</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {missingSurfaces.map((typeName) => {
          const subtypes = getSubtypesByType(typeName)

          return (
            <DropdownMenuSub key={typeName}>
              <DropdownMenuSubTrigger>{typeName}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {subtypes.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => handleSubtypeSelect(model.id)}
                  >
                    {model.subtype?.subTypeName ?? model.modelName}
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
