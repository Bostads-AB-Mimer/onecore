import React from 'react'
import { Settings2 } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'

export interface ColumnDefinition {
  key: string
  label: string
  locked?: boolean
}

interface ColumnSelectorProps {
  columns: ColumnDefinition[]
  visibleColumns: string[]
  onVisibilityChange: (columnKey: string, visible: boolean) => void
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onVisibilityChange,
}: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Kolumner
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-background z-50">
        <DropdownMenuLabel>Visa kolumner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visibleColumns.includes(col.key)}
            onCheckedChange={(checked) => onVisibilityChange(col.key, checked)}
            disabled={col.locked}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  { key: 'costCenter', label: 'K-ställe', locked: true },
  { key: 'kvvArea', label: 'KVV-område' },
  { key: 'stewardName', label: 'Kvartersvärd' },
  { key: 'stewardRefNr', label: 'Ref.nr' },
  { key: 'propertyName', label: 'Fastighet' },
  { key: 'address', label: 'Adress' },
  { key: 'buildingType', label: 'Typ' },
  { key: 'residenceCount', label: 'Antal bostäder' },
  { key: 'commercialCount', label: 'Antal lokaler' },
  { key: 'garageCount', label: 'Antal garage' },
  { key: 'parkingCount', label: 'Antal p-platser' },
  { key: 'otherCount', label: 'Antal övrigt' },
  { key: 'residenceArea', label: 'Yta bostad' },
  { key: 'commercialArea', label: 'Yta lokal' },
  { key: 'garageArea', label: 'Yta garage' },
  { key: 'entranceCount', label: 'Trappuppgångar' },
]

export const DEFAULT_VISIBLE_COLUMNS = [
  'costCenter',
  'kvvArea',
  'stewardName',
  'propertyName',
  'address',
  'buildingType',
  'residenceCount',
  'residenceArea',
]
