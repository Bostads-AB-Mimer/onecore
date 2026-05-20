import React, { useEffect, useState } from 'react'
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Building2, Car, DoorOpen, Home } from 'lucide-react'

import {
  getCostCenterName,
  getDistrictManagers,
  getUniqueCostCenters,
} from '@/features/property-areas'
import { useStewardAdmin } from '@/features/property-areas/hooks/useStewardAdmin'
import {
  StewardAdminMobile,
  StewardColumn,
} from '@/features/property-areas/ui/admin'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { useToast } from '@/shared/hooks/useToast'
import { Card, CardContent } from '@/shared/ui/Card'
import { ViewLayout } from '@/shared/ui/layout'
import { ScrollArea, ScrollBar } from '@/shared/ui/ScrollArea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

export function PropertyAreasPage() {
  const isMobile = useIsMobile()
  const { toast } = useToast()

  const costCenters = getUniqueCostCenters()
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all')
  const district =
    selectedCostCenter === 'all'
      ? undefined
      : getDistrictManagers(selectedCostCenter)

  const {
    kvvAreaList,
    propertiesByKvvArea,
    allStewards,
    reassignArea,
    reassignProperty,
  } = useStewardAdmin(selectedCostCenter)

  // Local order of KVV columns (per cost center)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const kvvAreaKey = kvvAreaList.map((k) => k.kvvArea).join('|')
  useEffect(() => {
    setOrderedIds(kvvAreaKey ? kvvAreaKey.split('|') : [])
  }, [kvvAreaKey])

  const orderedAreas = orderedIds
    .map((id) => kvvAreaList.find((k) => k.kvvArea === id))
    .filter(Boolean) as typeof kvvAreaList

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type

    // Property card dragged → reassign to target column's KVV area
    if (activeType === 'property') {
      const fromKvv = active.data.current?.kvvArea as string | undefined
      const overData = over.data.current as
        | { type?: string; kvvArea?: string }
        | undefined
      const toKvv = overData?.kvvArea
      if (!toKvv || toKvv === fromKvv) return

      reassignProperty(String(active.id), toKvv)

      const targetArea = kvvAreaList.find((k) => k.kvvArea === toKvv)
      const property = propertiesByKvvArea
        .get(fromKvv ?? '')
        ?.find((p) => p.id === active.id)
      toast({
        title: 'Fastighet flyttad',
        description: `${property?.propertyName ?? 'Fastigheten'} flyttades till ${toKvv}${targetArea ? ` (${targetArea.stewardName})` : ''}.`,
      })
      return
    }
  }

  const handleReassign = (kvvArea: string, toStewardRefNr: string) => {
    reassignArea(kvvArea, toStewardRefNr)
    const newSteward = allStewards.find((s) => s.refNr === toStewardRefNr)
    toast({
      title: 'Ansvarig uppdaterad',
      description: `${kvvArea} tilldelades ${newSteward?.name ?? toStewardRefNr}.`,
    })
  }

  return (
    <ViewLayout>
      <div className="flex flex-col h-full space-y-4 min-w-0 w-full">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Förvaltningsområden</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Byt ansvarig kvartersvärd för KVV-områden
          </p>
        </div>

        {/* Cost center + district info */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  Kostnadsställe/distrikt:
                </span>
                <Select
                  value={selectedCostCenter}
                  onValueChange={setSelectedCostCenter}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla kostnadsställen</SelectItem>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc} value={cc}>
                        {cc} - {getCostCenterName(cc)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {district && (
                <>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      Distriktschef
                    </span>
                    <span className="text-sm font-medium">
                      {district.districtManager}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      Biträdande distriktschef
                    </span>
                    <span className="text-sm font-medium">
                      {district.deputyDistrictManager}
                    </span>
                  </div>
                </>
              )}

              {(() => {
                const totals = kvvAreaList.reduce(
                  (acc, k) => ({
                    properties: acc.properties + k.propertyCount,
                    entrances: acc.entrances + k.entranceCount,
                    residences: acc.residences + k.residenceCount,
                    parking: acc.parking + k.parkingCount,
                  }),
                  { properties: 0, entrances: 0, residences: 0, parking: 0 }
                )
                return (
                  <div className="flex flex-col sm:ml-auto">
                    <span className="text-xs text-muted-foreground">
                      {selectedCostCenter === 'all'
                        ? 'Totalt'
                        : 'Distriktet totalt'}
                    </span>
                    <div className="flex items-center gap-4 text-sm font-medium mt-0.5">
                      <span
                        className="flex items-center gap-1.5"
                        title="Fastigheter"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {totals.properties}
                      </span>
                      <span
                        className="flex items-center gap-1.5"
                        title="Uppgångar"
                      >
                        <Home className="h-4 w-4 text-muted-foreground" />
                        {totals.entrances}
                      </span>
                      <span
                        className="flex items-center gap-1.5"
                        title="Bostäder"
                      >
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        {totals.residences}
                      </span>
                      <span
                        className="flex items-center gap-1.5"
                        title="Bilplatser"
                      >
                        <Car className="h-4 w-4 text-muted-foreground" />
                        {totals.parking}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Main content */}
        {isMobile ? (
          <StewardAdminMobile
            kvvAreas={orderedAreas}
            propertiesByKvvArea={propertiesByKvvArea}
            allStewards={allStewards}
            onReassignArea={handleReassign}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-4 p-1 min-h-[500px]">
                  {orderedAreas.map((kvvArea) => (
                    <StewardColumn
                      key={kvvArea.kvvArea}
                      kvvArea={kvvArea}
                      properties={
                        propertiesByKvvArea.get(kvvArea.kvvArea) || []
                      }
                      allStewards={allStewards}
                      onReassignArea={handleReassign}
                    />
                  ))}
                </div>
              </DndContext>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>
    </ViewLayout>
  )
}
