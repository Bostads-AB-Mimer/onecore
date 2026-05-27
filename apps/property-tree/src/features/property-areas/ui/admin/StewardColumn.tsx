import React, { useState } from 'react'
import { Building2, Car, DoorOpen, Home, Pencil } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader } from '@/shared/ui/Card'
import { ScrollArea } from '@/shared/ui/ScrollArea'

import { KvvAreaInfo, PropertyForAdmin } from '../../types/adminTypes'
import { PropertyCard } from './PropertyCard'
import { StewardAssignmentDialog } from './StewardAssignmentDialog'

interface Steward {
  refNr: string
  name: string
  phone?: string
}

interface StewardColumnProps {
  kvvArea: KvvAreaInfo
  properties: PropertyForAdmin[]
  allStewards?: Steward[]
  onReassignArea?: (kvvArea: string, toStewardRefNr: string) => void
  canEdit?: boolean
}

export function StewardColumn({
  kvvArea,
  properties,
  allStewards = [],
  onReassignArea,
  canEdit,
}: StewardColumnProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false)

  const handleAssign = (newStewardRefNr: string) => {
    onReassignArea?.(kvvArea.kvvArea, newStewardRefNr)
  }

  return (
    <>
      <Card className="flex-shrink-0 w-[280px] flex flex-col h-full">
        <CardHeader className="pb-3 space-y-1">
          <div className="flex items-start justify-between">
            <div className="font-bold text-lg">{kvvArea.kvvArea}</div>
            {onReassignArea && (
              <Button
                variant="subtle"
                size="icon"
                className="h-7 w-7 -mt-1 -mr-2"
                disabled={canEdit === false}
                title={
                  canEdit === false
                    ? 'Du saknar behörighet att ändra förvaltningsområde'
                    : undefined
                }
                onClick={() => setShowAssignDialog(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="font-medium text-sm">{kvvArea.stewardName}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {kvvArea.stewardRefNr && <span>{kvvArea.stewardRefNr}</span>}
            {kvvArea.stewardRefNr && kvvArea.stewardPhone && <span>•</span>}
            {kvvArea.stewardPhone && <span>{kvvArea.stewardPhone}</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1" title="Fastigheter">
              <Building2 className="h-3.5 w-3.5" />
              {kvvArea.propertyCount}
            </span>
            {kvvArea.entranceCount > 0 && (
              <span className="flex items-center gap-1" title="Uppgångar">
                <Home className="h-3.5 w-3.5" />
                {kvvArea.entranceCount}
              </span>
            )}
            <span className="flex items-center gap-1" title="Bostäder">
              <DoorOpen className="h-3.5 w-3.5" />
              {kvvArea.residenceCount}
            </span>
            {kvvArea.parkingCount > 0 && (
              <span className="flex items-center gap-1" title="P-platser">
                <Car className="h-3.5 w-3.5" />
                {kvvArea.parkingCount}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full px-4 pb-4">
            <div className="space-y-2 min-h-[120px]">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
              {properties.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm rounded-md border border-dashed">
                  Inga fastigheter
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <StewardAssignmentDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        kvvArea={kvvArea.kvvArea}
        currentSteward={{
          refNr: kvvArea.stewardRefNr,
          name: kvvArea.stewardName,
          phone: kvvArea.stewardPhone,
        }}
        allStewards={allStewards}
        onAssign={handleAssign}
      />
    </>
  )
}
