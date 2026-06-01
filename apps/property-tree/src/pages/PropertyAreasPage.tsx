import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Car, DoorOpen, Home } from 'lucide-react'

import {
  type KvvAreaInfo,
  PendingPropertyMovesPanel,
  PropertyCard,
  type PropertyForAdmin,
  type PropertyMoveChange,
  StewardAdminMobile,
  StewardColumn,
  useCanEditPropertyAreas,
  useCostCenters,
  useCostCenterTree,
  useUpdatePropertyKvvArea,
} from '@/features/property-areas'
import { COLUMN_INNER_WIDTH_PX } from '@/features/property-areas/constants'
import {
  mapKvvArea,
  mapProperties,
} from '@/features/property-areas/utils/treeMappers'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { useToast } from '@/shared/hooks/useToast'
import { formatUserName } from '@/shared/lib/formatters'
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

  const { data: costCenters = [], isLoading: costCentersLoading } =
    useCostCenters()

  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('')

  useEffect(() => {
    if (!selectedCostCenterId && costCenters.length > 0) {
      setSelectedCostCenterId(costCenters[0].id)
    }
  }, [costCenters, selectedCostCenterId])

  const { data: tree, isLoading: treeLoading } = useCostCenterTree(
    selectedCostCenterId || undefined
  )

  const canEdit = useCanEditPropertyAreas(selectedCostCenterId || undefined)

  // propertyCode → target kvvAreaId. Source of truth for user intent;
  // pendingChanges + propertiesByKvvArea derive from it + tree. Fulfilled
  // entries become inert (filtered out by pendingChanges) until cleared.
  const [propertyOverrides, setPropertyOverrides] = useState<
    Map<string, string>
  >(() => new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [activeDragProperty, setActiveDragProperty] =
    useState<PropertyForAdmin | null>(null)

  useEffect(() => {
    setPropertyOverrides(new Map())
  }, [selectedCostCenterId])

  const kvvAreaList = useMemo<KvvAreaInfo[]>(() => {
    if (!tree) return []
    return tree.kvvAreas
      .map(mapKvvArea)
      .sort((a, b) => a.kvvArea.localeCompare(b.kvvArea))
  }, [tree])

  // Derived: a pending change is an override whose target column does not yet
  // match the tree's current placement of the property. When the backend
  // accepts a move and the tree refetches, that entry naturally drops out.
  const pendingChanges = useMemo<PropertyMoveChange[]>(() => {
    if (!tree) return []
    const result: PropertyMoveChange[] = []
    for (const [propertyCode, toKvvAreaId] of propertyOverrides) {
      const fromArea = tree.kvvAreas.find((a) =>
        a.properties.some((p) => p.code === propertyCode)
      )
      if (!fromArea || fromArea.id === toKvvAreaId) continue
      const toArea = tree.kvvAreas.find((k) => k.id === toKvvAreaId)
      const property = fromArea.properties.find((p) => p.code === propertyCode)
      if (!property) continue
      result.push({
        propertyCode,
        propertyName: property.designation ?? propertyCode,
        fromKvvAreaId: fromArea.id,
        fromKvvArea: fromArea.code,
        toKvvAreaId,
        toKvvArea: toArea?.code ?? '',
      })
    }
    return result
  }, [propertyOverrides, tree])

  // Build the property → column map. We read overrides via `pendingChanges`
  // (already filtered against tree) so fulfilled overrides don't keep cards
  // pinned to the top of their target column after a save.
  const propertiesByKvvArea = useMemo(() => {
    const grouped = new Map<string, PropertyForAdmin[]>()
    if (!tree) return grouped

    // Initialise an empty bucket per known column so empty drop zones render.
    for (const area of tree.kvvAreas) grouped.set(area.id, [])

    const overrideByCode = new Map(
      pendingChanges.map((c) => [c.propertyCode, c.toKvvAreaId])
    )

    for (const area of tree.kvvAreas) {
      for (const property of mapProperties(area)) {
        const overrideId = overrideByCode.get(property.propertyCode)
        const targetId = overrideId ?? area.id
        const targetCode =
          tree.kvvAreas.find((k) => k.id === targetId)?.code ?? area.code
        const bucket = grouped.get(targetId) ?? []
        const card: PropertyForAdmin = {
          ...property,
          kvvAreaId: targetId,
          kvvArea: targetCode,
        }
        // Pending moves go to the top of their new column so the user can see
        // what's about to be saved without scrolling.
        if (overrideId) bucket.unshift(card)
        else bucket.push(card)
        grouped.set(targetId, bucket)
      }
    }
    return grouped
  }, [tree, pendingChanges])

  // Map indexed by kvvAreaId (matches StewardColumn / useDroppable)
  const lead = tree ? formatUserName(tree.lead) : undefined
  const deputy = tree ? formatUserName(tree.deputy) : undefined

  const totals = kvvAreaList.reduce(
    (acc, k) => ({
      properties: acc.properties + k.propertyCount,
      entrances: acc.entrances + k.entranceCount,
      residences: acc.residences + k.residenceCount,
      parking: acc.parking + k.parkingCount,
    }),
    { properties: 0, entrances: 0, residences: 0, parking: 0 }
  )

  const pendingPropertyCodes = useMemo(
    () => new Set(pendingChanges.map((c) => c.propertyCode)),
    [pendingChanges]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { type?: string; propertyCode?: string }
        | undefined
      if (data?.type !== 'property' || !data.propertyCode) return

      // Find the displayed card so the overlay can mirror it 1:1.
      for (const list of propertiesByKvvArea.values()) {
        const match = list.find((p) => p.propertyCode === data.propertyCode)
        if (match) {
          setActiveDragProperty(match)
          return
        }
      }
    },
    [propertiesByKvvArea]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragProperty(null)
      const { active, over } = event
      if (!over) return

      const activeData = active.data.current as
        | { type?: string; propertyCode?: string }
        | undefined
      const overData = over.data.current as
        | { type?: string; kvvAreaId?: string }
        | undefined

      if (activeData?.type !== 'property') return
      if (overData?.type !== 'column') return

      const propertyCode = activeData.propertyCode
      const toKvvAreaId = overData.kvvAreaId
      if (!propertyCode || !toKvvAreaId) return

      // Original column = where the tree currently has the property. We use
      // tree (the source of truth) so dropping a card back into its original
      // column always cleanly removes the override.
      const originalKvvAreaId = tree?.kvvAreas.find((a) =>
        a.properties.some((p) => p.code === propertyCode)
      )?.id
      if (!originalKvvAreaId) return

      // Current displayed column is the override (if any) or the original.
      const currentKvvAreaId =
        propertyOverrides.get(propertyCode) ?? originalKvvAreaId
      if (currentKvvAreaId === toKvvAreaId) return // no-op

      setPropertyOverrides((prev) => {
        const next = new Map(prev)
        if (toKvvAreaId === originalKvvAreaId) {
          next.delete(propertyCode)
        } else {
          next.set(propertyCode, toKvvAreaId)
        }
        return next
      })
    },
    [propertyOverrides, tree]
  )

  const handleUndo = useCallback((propertyCode: string) => {
    setPropertyOverrides((prev) => {
      const next = new Map(prev)
      next.delete(propertyCode)
      return next
    })
  }, [])

  const handleCancelAll = useCallback(() => {
    setPropertyOverrides(new Map())
  }, [])

  const updateMutation = useUpdatePropertyKvvArea()
  const queryClient = useQueryClient()

  const handleSave = useCallback(async () => {
    if (pendingChanges.length === 0 || isSaving) return
    setIsSaving(true)

    // Fire all PUTs in parallel; invalidate the tree once after they settle so
    // we trigger one refetch instead of N. Fulfilled entries drop out of
    // pendingChanges automatically once the new tree lands.
    const results = await Promise.allSettled(
      pendingChanges.map((change) =>
        updateMutation.mutateAsync({
          propertyCode: change.propertyCode,
          kvvAreaId: change.toKvvAreaId,
        })
      )
    )
    await queryClient.invalidateQueries({ queryKey: ['costCenterTree'] })

    const failed = results.filter((r) => r.status === 'rejected').length
    const succeeded = results.length - failed

    if (succeeded > 0) {
      toast({
        title: 'Ändringar sparade',
        description: `${succeeded} ${succeeded === 1 ? 'fastighet flyttades' : 'fastigheter flyttades'}.`,
      })
    }
    if (failed > 0) {
      toast({
        title: 'Vissa ändringar misslyckades',
        description: `${failed} av ${results.length} flyttar gick inte att spara.`,
        variant: 'destructive',
      })
    }

    setIsSaving(false)
  }, [pendingChanges, isSaving, updateMutation, queryClient, toast])

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
                  value={selectedCostCenterId}
                  onValueChange={setSelectedCostCenterId}
                  disabled={costCentersLoading || costCenters.length === 0}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue
                      placeholder={
                        costCentersLoading ? 'Laddar...' : 'Välj kostnadsställe'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tree && (
                <>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      Distriktschef
                    </span>
                    <span className="text-sm font-medium">
                      {lead?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      Biträdande distriktschef
                    </span>
                    <span className="text-sm font-medium">
                      {deputy?.name ?? '—'}
                    </span>
                  </div>
                </>
              )}

              {tree && (
                <div className="flex flex-col sm:ml-auto">
                  <span className="text-xs text-muted-foreground">
                    Distriktet totalt
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
              )}
            </div>
          </CardContent>
        </Card>

        <PendingPropertyMovesPanel
          changes={pendingChanges}
          onUndo={handleUndo}
          onCancelAll={handleCancelAll}
          onSave={handleSave}
          isSaving={isSaving}
        />

        {/* Main content */}
        {treeLoading ? (
          <div className="text-sm text-muted-foreground">Laddar...</div>
        ) : !tree ? (
          <div className="text-sm text-muted-foreground">
            Välj ett kostnadsställe för att visa områden.
          </div>
        ) : isMobile ? (
          <StewardAdminMobile
            kvvAreas={kvvAreaList}
            propertiesByKvvArea={
              new Map(
                kvvAreaList.map((k) => [
                  k.kvvArea,
                  propertiesByKvvArea.get(k.kvvAreaId) ?? [],
                ])
              )
            }
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveDragProperty(null)}
              >
                <div className="flex gap-4 p-1 min-h-[500px]">
                  {kvvAreaList.map((kvvArea) => (
                    <StewardColumn
                      key={kvvArea.kvvAreaId}
                      kvvArea={kvvArea}
                      properties={
                        propertiesByKvvArea.get(kvvArea.kvvAreaId) ?? []
                      }
                      canEdit={canEdit}
                      isSaving={isSaving}
                      pendingPropertyCodes={pendingPropertyCodes}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeDragProperty ? (
                    <div style={{ width: COLUMN_INNER_WIDTH_PX }}>
                      <PropertyCard
                        property={activeDragProperty}
                        draggable
                        isOverlay
                        isPending={pendingPropertyCodes.has(
                          activeDragProperty.propertyCode
                        )}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>
    </ViewLayout>
  )
}
