import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { TableCell, TableRow } from '@/shared/ui/Table'

import { PropertyAreaEntry } from '../types'
import { GroupedPropertyEntry } from '../utils/groupProperties'
import { BuildingTypeBadge } from './BuildingTypeBadge'

interface ExpandablePropertyRowProps {
  group: GroupedPropertyEntry
  visibleColumns: string[]
  formatNumber: (num?: number) => string
}

export function ExpandablePropertyRow({
  group,
  visibleColumns,
  formatNumber,
}: ExpandablePropertyRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const renderCellContent = (
    columnKey: string,
    entry: PropertyAreaEntry | GroupedPropertyEntry,
    isChild = false
  ) => {
    switch (columnKey) {
      case 'costCenter':
        return isChild ? null : (
          <div className="flex flex-col">
            <span className="font-medium">{entry.costCenter}</span>
          </div>
        )
      case 'kvvArea':
        return isChild ? null : entry.kvvArea ? (
          <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
            {entry.kvvArea}
          </span>
        ) : (
          '-'
        )
      case 'stewardName':
        return isChild ? null : (
          <div className="flex flex-col">
            <span>{entry.stewardName}</span>
            {entry.stewardPhone && (
              <span className="text-xs text-muted-foreground">
                {entry.stewardPhone}
              </span>
            )}
          </div>
        )
      case 'stewardRefNr':
        return isChild ? null : entry.stewardRefNr
      case 'propertyName':
        return (
          <div className="flex flex-col">
            <span className="font-medium">{entry.propertyName}</span>
            <span className="text-xs text-muted-foreground">
              {entry.propertyCode}
            </span>
          </div>
        )
      case 'address':
        if ('addresses' in entry && Array.isArray(entry.addresses)) {
          return isChild
            ? (entry as any).address
            : entry.addresses.length > 1
              ? `${entry.addresses.length} adresser`
              : entry.addresses[0]
        }
        return (entry as PropertyAreaEntry).address
      case 'buildingType':
        return <BuildingTypeBadge type={entry.buildingType} />
      case 'residenceCount':
        return formatNumber(
          'residenceCount' in entry ? entry.residenceCount : undefined
        )
      case 'commercialCount':
        return formatNumber(
          'commercialCount' in entry ? entry.commercialCount : undefined
        )
      case 'garageCount':
        return formatNumber(
          'garageCount' in entry ? entry.garageCount : undefined
        )
      case 'parkingCount':
        return formatNumber(
          'parkingCount' in entry ? entry.parkingCount : undefined
        )
      case 'otherCount':
        return formatNumber(
          'otherCount' in entry ? entry.otherCount : undefined
        )
      case 'residenceArea':
        return 'residenceArea' in entry && entry.residenceArea
          ? formatNumber(entry.residenceArea as number)
          : '-'
      case 'commercialArea':
        return 'commercialArea' in entry && entry.commercialArea
          ? formatNumber(entry.commercialArea as number)
          : '-'
      case 'garageArea':
        return 'garageArea' in entry && entry.garageArea
          ? formatNumber(entry.garageArea as number)
          : '-'
      case 'entranceCount':
        return formatNumber(
          'entranceCount' in entry ? entry.entranceCount : undefined
        )
      default:
        return '-'
    }
  }

  // Main row
  const mainRow = (
    <TableRow
      className={group.isGroup ? 'cursor-pointer hover:bg-muted/50' : ''}
      onClick={() => group.isGroup && setIsExpanded(!isExpanded)}
    >
      {visibleColumns.map((columnKey, index) => (
        <TableCell key={columnKey}>
          <div className="flex items-center gap-2">
            {index === 0 && group.isGroup && (
              <span className="text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            )}
            {columnKey === 'address' && group.isGroup ? (
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
            ) : (
              renderCellContent(columnKey, group)
            )}
          </div>
        </TableCell>
      ))}
    </TableRow>
  )

  // Child rows when expanded
  const childRows =
    isExpanded && group.isGroup
      ? group.entries.map((entry, entryIndex) => (
          <TableRow key={entry.id} className="bg-muted/30">
            {visibleColumns.map((columnKey, colIndex) => (
              <TableCell key={columnKey} className="py-2">
                <div className="flex items-center gap-2">
                  {colIndex === 0 && (
                    <span className="w-4 ml-4 text-muted-foreground text-xs">
                      {entryIndex + 1}.
                    </span>
                  )}
                  {columnKey === 'address' ? (
                    <span className="text-sm">{entry.address}</span>
                  ) : columnKey === 'propertyName' ? null : (
                    <span className="text-sm text-muted-foreground">
                      {renderCellContent(columnKey, entry, true)}
                    </span>
                  )}
                </div>
              </TableCell>
            ))}
          </TableRow>
        ))
      : null

  return (
    <>
      {mainRow}
      {childRows}
    </>
  )
}
