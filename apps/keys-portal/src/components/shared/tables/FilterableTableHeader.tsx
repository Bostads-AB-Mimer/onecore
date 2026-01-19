import React from 'react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface FilterableTableHeaderProps {
  /** The label text for the column header */
  label: string
  /** Filter component to render (FilterDropdown, DateRangeFilterDropdown, etc.) */
  children?: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Width class (e.g., "w-[15%]") */
  width?: string
}

/**
 * A table header cell with an optional filter component.
 * Standardizes the filter-in-header pattern used across list tables.
 *
 * @example
 * ```tsx
 * <FilterableTableHeader label="Typ" width="w-[15%]">
 *   <FilterDropdown
 *     options={getKeyTypeFilterOptions()}
 *     selectedValue={selectedType}
 *     onSelectionChange={onTypeFilterChange}
 *   />
 * </FilterableTableHeader>
 * ```
 */
export function FilterableTableHeader({
  label,
  children,
  className,
  width,
}: FilterableTableHeaderProps) {
  return (
    <TableHead className={cn('font-medium', width, className)}>
      <div className="flex items-center gap-1">
        {label}
        {children}
      </div>
    </TableHead>
  )
}
