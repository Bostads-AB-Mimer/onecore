import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import {
  NullableDateFilterDropdown,
  NullableDateFilterValue,
} from '@/components/ui/nullable-date-filter-dropdown'
import { Label } from '@/components/ui/label'

interface KeyLoansToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  loanTypeFilter: string | null
  onLoanTypeFilterChange: (value: string | null) => void
  minKeys: number | null
  maxKeys: number | null
  onKeyCountChange: (min: number | null, max: number | null) => void
  pickedUpDateFilter: NullableDateFilterValue
  onPickedUpDateChange: (value: NullableDateFilterValue) => void
  returnedDateFilter: NullableDateFilterValue
  onReturnedDateChange: (value: NullableDateFilterValue) => void
}

export function KeyLoansToolbar({
  searchQuery,
  onSearchChange,
  loanTypeFilter,
  onLoanTypeFilterChange,
  minKeys,
  maxKeys,
  onKeyCountChange,
  pickedUpDateFilter,
  onPickedUpDateChange,
  returnedDateFilter,
  onReturnedDateChange,
}: KeyLoansToolbarProps) {
  const hasActiveFilters =
    loanTypeFilter !== null ||
    minKeys !== null ||
    maxKeys !== null ||
    pickedUpDateFilter.hasValue !== null ||
    pickedUpDateFilter.after !== null ||
    pickedUpDateFilter.before !== null ||
    returnedDateFilter.hasValue !== null ||
    returnedDateFilter.after !== null ||
    returnedDateFilter.before !== null

  const handleClearAllFilters = () => {
    onLoanTypeFilterChange(null)
    onKeyCountChange(null, null)
    onPickedUpDateChange({ hasValue: null, after: null, before: null })
    onReturnedDateChange({ hasValue: null, after: null, before: null })
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Search bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Sök kontakt, nyckel eller objekt..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-end gap-4 flex-wrap">
        {/* Loan Type Filter */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Lånetyp</Label>
          <FilterDropdown
            options={[
              { value: 'TENANT', label: 'Hyresgäst' },
              { value: 'MAINTENANCE', label: 'Underhåll' },
            ]}
            selectedValue={loanTypeFilter}
            onSelectionChange={onLoanTypeFilterChange}
          />
        </div>

        {/* Key Count Filter */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Antal nycklar</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={minKeys ?? ''}
              onChange={(e) =>
                onKeyCountChange(
                  e.target.value ? parseInt(e.target.value, 10) : null,
                  maxKeys
                )
              }
              className="w-20"
              min={0}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={maxKeys ?? ''}
              onChange={(e) =>
                onKeyCountChange(
                  minKeys,
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
              className="w-20"
              min={0}
            />
          </div>
        </div>

        {/* Picked Up Date Filter */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Upphämtat</Label>
          <NullableDateFilterDropdown
            label="Upphämtat"
            value={pickedUpDateFilter}
            onChange={onPickedUpDateChange}
          />
        </div>

        {/* Returned Date Filter */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Återlämnat</Label>
          <NullableDateFilterDropdown
            label="Återlämnat"
            value={returnedDateFilter}
            onChange={onReturnedDateChange}
          />
        </div>

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAllFilters}
            className="ml-auto"
          >
            Rensa alla filter
          </Button>
        )}
      </div>
    </div>
  )
}
