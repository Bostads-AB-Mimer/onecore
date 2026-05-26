import React, { useEffect, useMemo, useState } from 'react'
import { Building2, Car, DoorOpen, Home } from 'lucide-react'

import {
  type KvvAreaInfo,
  type PropertyForAdmin,
  StewardAdminMobile,
  StewardColumn,
  useCostCenters,
  useCostCenterTree,
} from '@/features/property-areas'

import type { CostCenterTree, CostCenterTreeKvvArea } from '@/services/types'

import { useIsMobile } from '@/shared/hooks/useMobile'
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

function formatUserName(user: CostCenterTree['lead']): {
  name: string
  subtitle?: string
} {
  if (!user) return { name: '—' }
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return {
    name: fullName || user.username,
    subtitle: user.email,
  }
}

function mapKvvArea(area: CostCenterTreeKvvArea): KvvAreaInfo {
  const aggregates = area.properties.reduce(
    (acc, p) => ({
      propertyCount: acc.propertyCount + 1,
      residenceCount: acc.residenceCount + p.aggregates.residenceCount,
      parkingCount: acc.parkingCount + p.aggregates.parkingCount,
      entranceCount: acc.entranceCount + p.aggregates.entranceCount,
    }),
    { propertyCount: 0, residenceCount: 0, parkingCount: 0, entranceCount: 0 }
  )

  const stewardName = area.responsible
    ? formatUserName(area.responsible).name
    : area.name || area.code

  return {
    kvvArea: area.code,
    stewardRefNr: area.responsible?.employeeId ?? '',
    stewardName,
    stewardPhone: area.responsible?.mobilePhone,
    propertyCount: aggregates.propertyCount,
    residenceCount: aggregates.residenceCount,
    parkingCount: aggregates.parkingCount,
    entranceCount: aggregates.entranceCount,
  }
}

function splitAddress(address: string): { name: string; number: number } {
  const m = address.match(/^(.*?)(\d+)/)
  if (!m) return { name: address.trim(), number: 0 }
  return { name: m[1].trim(), number: parseInt(m[2], 10) }
}

function sortAddresses(addresses: string[]): string[] {
  return Array.from(new Set(addresses)).sort((a, b) => {
    const sa = splitAddress(a)
    const sb = splitAddress(b)
    const nameCmp = sa.name.localeCompare(sb.name, 'sv')
    if (nameCmp !== 0) return nameCmp
    return sa.number - sb.number
  })
}

function mapProperties(area: CostCenterTreeKvvArea): PropertyForAdmin[] {
  return area.properties.map((property) => ({
    id: `${area.code}-${property.code}`,
    propertyCode: property.code,
    propertyName: property.designation || property.tract || property.code,
    addresses: sortAddresses(
      property.addresses
        .map((a) => a.buildingName)
        .filter((v): v is string => !!v)
    ),
    buildingType:
      property.addresses.find((a) => a.buildingType)?.buildingType ?? null,
    kvvArea: area.code,
    stewardRefNr: area.responsible?.username ?? '',
    costCenter: '',
    residenceCount: property.aggregates.residenceCount,
    parkingCount: property.aggregates.parkingCount,
    entranceCount: property.aggregates.entranceCount,
  }))
}

export function PropertyAreasPage() {
  const isMobile = useIsMobile()

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

  const kvvAreaList = useMemo<KvvAreaInfo[]>(() => {
    if (!tree) return []
    return tree.kvvAreas
      .map(mapKvvArea)
      .sort((a, b) => a.kvvArea.localeCompare(b.kvvArea))
  }, [tree])

  const propertiesByKvvArea = useMemo(() => {
    const grouped = new Map<string, PropertyForAdmin[]>()
    if (!tree) return grouped
    tree.kvvAreas.forEach((area) => {
      grouped.set(area.code, mapProperties(area))
    })
    return grouped
  }, [tree])

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
            propertiesByKvvArea={propertiesByKvvArea}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <div className="flex gap-4 p-1 min-h-[500px]">
                {kvvAreaList.map((kvvArea) => (
                  <StewardColumn
                    key={kvvArea.kvvArea}
                    kvvArea={kvvArea}
                    properties={propertiesByKvvArea.get(kvvArea.kvvArea) || []}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>
    </ViewLayout>
  )
}
