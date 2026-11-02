import { Plus, Search } from 'lucide-react'

import { formatCount } from '@/shared/lib/formatCount'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

interface TableToolbarProps {
  onAddNew?: () => void
  addNewLabel?: string
  itemCount?: number
  levelName: string
  levelNameSingular?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
}

export const TableToolbar = ({
  onAddNew,
  addNewLabel,
  itemCount,
  levelName,
  levelNameSingular,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
}: TableToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
      <div className="flex flex-wrap items-center gap-3 basis-full sm:basis-0 flex-1 min-w-0">
        {onSearchChange && (
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground pointer-events-none -translate-y-1/2" />
            <Input
              type="search"
              aria-label={searchPlaceholder || `Sök ${levelName.toLowerCase()}`}
              placeholder={
                searchPlaceholder || `Sök ${levelName.toLowerCase()}...`
              }
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        )}
        {filters}
        {itemCount !== undefined && (
          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
            {formatCount(itemCount, levelNameSingular ?? levelName, levelName)}
          </span>
        )}
      </div>
      {onAddNew && addNewLabel && (
        <Button onClick={onAddNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {addNewLabel}
        </Button>
      )}
    </div>
  )
}
