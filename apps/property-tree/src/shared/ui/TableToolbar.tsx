import { Plus, Search } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

interface TableToolbarProps {
  onAddNew: () => void
  addNewLabel: string
  itemCount?: number
  levelName: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
}

export const TableToolbar = ({
  onAddNew,
  addNewLabel,
  itemCount,
  levelName,
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: TableToolbarProps) => {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-4 flex-1">
        {onSearchChange && (
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground pointer-events-none -translate-y-1/2" />
            <Input
              type="search"
              placeholder={
                searchPlaceholder || `Sök ${levelName.toLowerCase()}...`
              }
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        )}
        {itemCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            {itemCount} {levelName}
          </span>
        )}
      </div>
      <Button onClick={onAddNew}>
        <Plus className="h-4 w-4 mr-2" />
        {addNewLabel}
      </Button>
    </div>
  )
}
