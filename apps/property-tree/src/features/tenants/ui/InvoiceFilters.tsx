import { X } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { DateRangeFilterDropdown } from '@/shared/ui/filters'

interface InvoiceFiltersProps {
  fromDate: Date | undefined
  toDate: Date | undefined
  onFromDateChange: (date: Date | undefined) => void
  onToDateChange: (date: Date | undefined) => void
}

export function InvoiceFilters({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: InvoiceFiltersProps) {
  const hasActiveFilters = fromDate || toDate

  const clearAll = () => {
    onFromDateChange(undefined)
    onToDateChange(undefined)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangeFilterDropdown
        startDate={fromDate?.toDateString() ?? null}
        endDate={toDate?.toDateString() ?? null}
        onDateChange={(startDate, endDate) => {
          onFromDateChange(startDate)
          onToDateChange(endDate)
        }}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
          <X className="h-4 w-4" />
          Rensa filter
        </Button>
      )}
    </div>
  )
}
