import React, { useState } from 'react'
import { Pencil } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  MobileAccordion,
  MobileAccordionItem,
} from '@/shared/ui/MobileAccordion'

import { KvvAreaInfo, PropertyForAdmin } from '../../types/adminTypes'
import { AddressList } from '../AddressList'
import { StewardAssignmentDialog } from './StewardAssignmentDialog'

interface Steward {
  id: string
  name: string
  employeeId?: string
  phone?: string
}

interface StewardAdminMobileProps {
  kvvAreas: KvvAreaInfo[]
  propertiesByKvvArea: Map<string, PropertyForAdmin[]>
  allStewards?: Steward[]
  onReassignArea?: (kvvAreaId: string, toStewardId: string) => void
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

  const handleAssign = (newStewardId: string) => {
    if (selectedKvvArea && onReassignArea) {
      onReassignArea(selectedKvvArea.kvvAreaId, newStewardId)
    }
  }

  const accordionItems: MobileAccordionItem[] = kvvAreas.map((kvvArea) => {
    const properties = propertiesByKvvArea.get(kvvArea.kvvAreaId) || []

    return {
      id: kvvArea.kvvAreaId,
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
          {(kvvArea.stewardEmployeeId || kvvArea.stewardPhone) && (
            <div className="text-sm text-muted-foreground px-2">
              {kvvArea.stewardEmployeeId}
              {kvvArea.stewardEmployeeId && kvvArea.stewardPhone && ' • '}
              {kvvArea.stewardPhone}
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
                  <AddressList addresses={property.addresses} />
                  {property.buildingType?.name && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {property.buildingType.name}
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
        defaultOpen={kvvAreas.length > 0 ? [kvvAreas[0].kvvAreaId] : []}
      />

      {selectedKvvArea && (
        <StewardAssignmentDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          kvvArea={selectedKvvArea.kvvArea}
          currentSteward={{
            id: selectedKvvArea.stewardId,
            name: selectedKvvArea.stewardName,
            employeeId: selectedKvvArea.stewardEmployeeId,
            phone: selectedKvvArea.stewardPhone,
          }}
          allStewards={allStewards}
          onAssign={handleAssign}
        />
      )}
    </>
  )
}
