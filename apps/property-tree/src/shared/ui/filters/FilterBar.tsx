import { type ReactNode } from 'react'
import { Search } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

interface FilterBarProps {
  /** Current search input value */
  searchValue?: string
  /** Called when search input changes */
  onSearchChange?: (value: string) => void
  /** Placeholder for the search input */
  searchPlaceholder?: string
  /** Whether any filters are active (controls visibility of clear button) */
  hasActiveFilters?: boolean
  /** Called when "Rensa alla filter" is clicked */
  onClearFilters?: () => void
  /** Filter dropdown components */
  children: ReactNode
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Sök...',
  hasActiveFilters = false,
  onClearFilters,
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4">
      {onSearchChange !== undefined && (
        <div className="w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-10"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 ml-1 h-4">
            {searchValue && searchValue.length > 0 && searchValue.length < 3
              ? 'Skriv minst 3 tecken för att söka'
              : '\u00A0'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {children}

        {hasActiveFilters && onClearFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Rensa alla filter
          </Button>
        )}
      </div>
    </div>
  )
}
