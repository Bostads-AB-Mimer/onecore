import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { Card } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

import { COST_CENTER_NAMES, PropertyAreaEntry } from '../types'
import {
  GroupedPropertyEntry,
  groupPropertyEntries,
} from '../utils/groupProperties'
import { BuildingTypeBadge } from './BuildingTypeBadge'

interface PropertyAreasTableProps {
  entries: PropertyAreaEntry[]
  visibleColumns: string[]
}

const COLUMN_LABELS: Record<string, string> = {
  costCenter: 'K-ställe',
  kvvArea: 'KVV',
  stewardName: 'Kvartersvärd',
  stewardRefNr: 'Ref.nr',
  propertyName: 'Fastighet',
  address: 'Adress',
  buildingType: 'Typ',
  residenceCount: 'Bostäder',
  commercialCount: 'Lokaler',
  garageCount: 'Garage',
  parkingCount: 'P-platser',
  otherCount: 'Övrigt',
  residenceArea: 'Yta bostad',
  commercialArea: 'Yta lokal',
  garageArea: 'Yta garage',
  entranceCount: 'Trappor',
}

export function PropertyAreasTable({
  entries,
  visibleColumns,
}: PropertyAreasTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const isMobile = useIsMobile()

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null || num === 0) return '-'
    return num.toLocaleString('sv-SE')
  }

  // Group entries by propertyCode + propertyName + buildingType
  const groupedEntries = useMemo(() => groupPropertyEntries(entries), [entries])

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const renderCellContent = (
    columnKey: string,
    group: GroupedPropertyEntry,
    isChild = false,
    childEntry?: PropertyAreaEntry
  ) => {
    const entry = isChild && childEntry ? childEntry : group

    switch (columnKey) {
      case 'costCenter':
        if (isChild) return null
        return (
          <div className="flex flex-col">
            <span className="font-medium">{group.costCenter}</span>
            <span className="text-xs text-muted-foreground">
              {COST_CENTER_NAMES[group.costCenter] || group.costCenter}
            </span>
          </div>
        )
      case 'kvvArea':
        if (isChild) return null
        return group.kvvArea ? (
          <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
            {group.kvvArea}
          </span>
        ) : (
          '-'
        )
      case 'stewardName':
        if (isChild) return null
        return (
          <div className="flex flex-col">
            <span>{group.stewardName}</span>
            {group.stewardPhone && (
              <span className="text-xs text-muted-foreground">
                {group.stewardPhone}
              </span>
            )}
          </div>
        )
      case 'stewardRefNr':
        if (isChild) return null
        return group.stewardRefNr
      case 'propertyName':
        if (isChild) return null
        return (
          <div className="flex flex-col">
            <span className="font-medium">{group.propertyName}</span>
            <span className="text-xs text-muted-foreground">
              {group.propertyCode}
            </span>
          </div>
        )
      case 'address':
        if (isChild && childEntry) {
          return <span className="text-sm pl-8">{childEntry.address}</span>
        }
        if (group.isGroup) {
          const isExpanded = expandedGroups.has(group.groupKey)
          return (
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${isExpanded ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/20'}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
              <div className="flex flex-col">
                <span className="font-medium text-primary">
                  {group.addresses.length} adresser
                </span>
                {!isExpanded && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {group.addresses.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )
        }
        return group.addresses[0]
      case 'buildingType':
        if (isChild) return null
        return <BuildingTypeBadge type={group.buildingType} />
      case 'residenceCount':
        if (isChild && childEntry)
          return formatNumber(childEntry.residenceCount)
        return formatNumber(group.residenceCount)
      case 'commercialCount':
        if (isChild && childEntry)
          return formatNumber(childEntry.commercialCount)
        return formatNumber(group.commercialCount)
      case 'garageCount':
        if (isChild && childEntry) return formatNumber(childEntry.garageCount)
        return formatNumber(group.garageCount)
      case 'parkingCount':
        if (isChild && childEntry) return formatNumber(childEntry.parkingCount)
        return formatNumber(group.parkingCount)
      case 'otherCount':
        if (isChild && childEntry) return formatNumber(childEntry.otherCount)
        return formatNumber(group.otherCount)
      case 'residenceArea':
        if (isChild && childEntry)
          return childEntry.residenceArea
            ? formatNumber(childEntry.residenceArea)
            : '-'
        return group.residenceArea ? formatNumber(group.residenceArea) : '-'
      case 'commercialArea':
        if (isChild && childEntry)
          return childEntry.commercialArea
            ? formatNumber(childEntry.commercialArea)
            : '-'
        return group.commercialArea ? formatNumber(group.commercialArea) : '-'
      case 'garageArea':
        if (isChild && childEntry)
          return childEntry.garageArea
            ? formatNumber(childEntry.garageArea)
            : '-'
        return group.garageArea ? formatNumber(group.garageArea) : '-'
      case 'entranceCount':
        if (isChild && childEntry) return formatNumber(childEntry.entranceCount)
        return formatNumber(group.entranceCount)
      default:
        return '-'
    }
  }

  // Mobile card renderer
  const renderMobileCard = (group: GroupedPropertyEntry) => {
    const isExpanded = expandedGroups.has(group.groupKey)

    return (
      <Card
        key={group.id}
        className={`p-4 ${group.isGroup ? 'cursor-pointer' : ''}`}
        onClick={() => group.isGroup && toggleGroup(group.groupKey)}
      >
        <div className="space-y-2 w-full">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{group.propertyName}</div>
              {group.isGroup ? (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${isExpanded ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </span>
                  <span className="text-sm text-primary">
                    {group.addresses.length} adresser
                  </span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground truncate">
                  {group.addresses[0]}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex gap-1">
                <span className="text-xs font-medium bg-muted px-2 py-1 rounded">
                  {group.costCenter}
                </span>
                {group.kvvArea && (
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                    {group.kvvArea}
                  </span>
                )}
              </div>
              <BuildingTypeBadge type={group.buildingType} />
            </div>
          </div>

          {/* Show expanded addresses for groups */}
          {group.isGroup && isExpanded && (
            <div className="ml-6 mt-2 space-y-1 border-l-2 border-primary/20 pl-3">
              {group.entries.map((entry, index) => (
                <div key={entry.id} className="text-sm">
                  <span className="text-muted-foreground">{index + 1}. </span>
                  <span>{entry.address}</span>
                  {(entry.residenceCount || entry.residenceArea) && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (
                      {entry.residenceCount
                        ? `${entry.residenceCount} bost`
                        : ''}
                      {entry.residenceCount && entry.residenceArea ? ', ' : ''}
                      {entry.residenceArea
                        ? `${formatNumber(entry.residenceArea)} kvm`
                        : ''}
                      )
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-sm">
            <span className="text-muted-foreground">Kvartersvärd: </span>
            <span>{group.stewardName}</span>
            {group.stewardPhone && (
              <span className="text-muted-foreground ml-1">
                ({group.stewardPhone})
              </span>
            )}
          </div>
          {(group.residenceCount || group.residenceArea) && (
            <div className="text-sm text-muted-foreground">
              {group.residenceCount > 0 && (
                <span>{group.residenceCount} bostäder</span>
              )}
              {group.residenceCount > 0 && group.residenceArea > 0 && (
                <span> • </span>
              )}
              {group.residenceArea > 0 && (
                <span>{formatNumber(group.residenceArea)} kvm</span>
              )}
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>Ref: {group.stewardRefNr}</span>
            <span>Fnr: {group.propertyCode}</span>
          </div>
        </div>
      </Card>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {groupedEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Inga områden hittades
          </div>
        ) : (
          groupedEntries.map((group) => renderMobileCard(group))
        )}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map((columnKey) => (
              <TableHead key={columnKey}>
                {COLUMN_LABELS[columnKey] || columnKey}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedEntries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleColumns.length}
                className="text-center py-8"
              >
                Inga områden hittades
              </TableCell>
            </TableRow>
          ) : (
            groupedEntries.map((group) => {
              const isExpanded = expandedGroups.has(group.groupKey)

              return (
                <React.Fragment key={group.id}>
                  {/* Main row */}
                  <TableRow
                    className={
                      group.isGroup ? 'cursor-pointer hover:bg-muted/50' : ''
                    }
                    onClick={() => group.isGroup && toggleGroup(group.groupKey)}
                  >
                    {visibleColumns.map((columnKey) => (
                      <TableCell key={columnKey}>
                        <div className="flex items-center gap-2">
                          {renderCellContent(columnKey, group)}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Expanded child rows */}
                  {isExpanded &&
                    group.isGroup &&
                    group.entries.map((entry, entryIndex) => (
                      <TableRow
                        key={entry.id}
                        className="bg-muted/30 hover:bg-muted/40"
                      >
                        {visibleColumns.map((columnKey, colIndex) => (
                          <TableCell key={columnKey} className="py-2">
                            <div className="flex items-center gap-2">
                              {colIndex === 0 && (
                                <span className="w-4 ml-4 text-muted-foreground text-xs">
                                  {entryIndex + 1}.
                                </span>
                              )}
                              {renderCellContent(columnKey, group, true, entry)}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </React.Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
