import React, { useState } from 'react'
import { Pencil } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { KvvAreaInfo, PropertyForAdmin } from '../../types/adminTypes'
import { getBuildingTypeName } from '../../utils/buildingTypeHelpers'
import { StewardAssignmentDialog } from './StewardAssignmentDialog'

interface Steward {
  refNr: string
  name: string
  phone?: string
}

interface StewardAdminMobileProps {
  kvvAreas: KvvAreaInfo[]
  propertiesByKvvArea: Map<string, PropertyForAdmin[]>
  allStewards?: Steward[]
  onReassignArea?: (kvvArea: string, toStewardRefNr: string) => void
}

export function StewardAdminMobile({
  kvvAreas,
  propertiesByKvvArea,
  allStewards = [],
  onReassignArea,
}: StewardAdminMobileProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedKvvArea, setSelectedKvvArea] = useState<KvvAreaInfo | null>(
    null
  )

  const handleOpenAssignDialog = (kvvArea: KvvAreaInfo) => {
    setSelectedKvvArea(kvvArea)
    setShowAssignDialog(true)
  }

  const handleAssign = (newStewardRefNr: string) => {
    if (selectedKvvArea && onReassignArea) {
      onReassignArea(selectedKvvArea.kvvArea, newStewardRefNr)
    }
  }

  const accordionItems: MobileAccordionItem[] = kvvAreas.map((kvvArea) => {
    const properties = propertiesByKvvArea.get(kvvArea.kvvArea) || []

    return {
      id: kvvArea.kvvArea,
      title: (
        <div className="flex items-center justify-between w-full pr-2">
          <span>
            {kvvArea.kvvArea} - {kvvArea.stewardName} ({properties.length})
          </span>
          {onReassignArea && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenAssignDialog(kvvArea)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      content: (
        <div className="space-y-3">
          {kvvArea.stewardPhone && (
            <div className="text-sm text-muted-foreground px-2">
              {kvvArea.stewardRefNr} • {kvvArea.stewardPhone}
            </div>
          )}

          {properties.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Inga fastigheter
            </div>
          ) : (
            properties.map((property) => (
              <div
                key={property.id}
                className="p-3 rounded-md border bg-card space-y-2"
              >
                <div>
                  <div className="font-medium text-sm">
                    {property.propertyName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {property.address}
                  </div>
                  {property.buildingType && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {getBuildingTypeName(property.buildingType)}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ),
    }
  })

  return (
    <>
      <MobileAccordion
        items={accordionItems}
        defaultOpen={kvvAreas.length > 0 ? [kvvAreas[0].kvvArea] : []}
      />

      {selectedKvvArea && (
        <StewardAssignmentDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          kvvArea={selectedKvvArea.kvvArea}
          currentSteward={{
            refNr: selectedKvvArea.stewardRefNr,
            name: selectedKvvArea.stewardName,
            phone: selectedKvvArea.stewardPhone,
          }}
          allStewards={allStewards}
          onAssign={handleAssign}
        />
      )}
    </>
  )
}
