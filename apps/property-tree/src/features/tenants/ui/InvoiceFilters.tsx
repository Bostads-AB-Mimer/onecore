import { Invoice, InvoicePaymentEvent } from '@onecore/types'
import { X } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { DateRangeFilterDropdown } from '@/shared/ui/filters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

export type InvoiceDateField =
  | 'none'
  | keyof Pick<Invoice, 'invoiceDate' | 'expirationDate'>
  | keyof Pick<InvoicePaymentEvent, 'paymentDate'>

export type InvoiceTypeField = 'all' | 'rent' | 'miscellaneous'
export type InvoiceStatusField =
  | 'all'
  | 'Obetald'
  | 'Betald'
  | 'Delvis betald'
  | 'Förfallen'

interface InvoiceFiltersProps {
  typeFilter: string
  onTypeFilterChange: (value: InvoiceTypeField) => void
  statusFilter: string | undefined
  onStatusFilterChange: (value: InvoiceStatusField) => void
  dateField: InvoiceDateField
  onDateFieldChange: (value: InvoiceDateField) => void
  fromDate: Date | undefined
  toDate: Date | undefined
  onFromDateChange: (date: Date | undefined) => void
  onToDateChange: (date: Date | undefined) => void
}

export function InvoiceFilters({
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateField,
  onDateFieldChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: InvoiceFiltersProps) {
  const hasActiveFilters =
    typeFilter || statusFilter || dateField || fromDate || toDate

  const clearAll = () => {
    onTypeFilterChange('all')
    onStatusFilterChange('all')
    onDateFieldChange('none')
    onFromDateChange(undefined)
    onToDateChange(undefined)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={typeFilter || 'all'}
        onValueChange={(v) => onTypeFilterChange(v as InvoiceTypeField)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Alla fakturatyper" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla fakturatyper</SelectItem>
          <SelectItem value="rent">Avi</SelectItem>
          <SelectItem value="miscellaneous">Ströfaktura</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={statusFilter || 'all'}
        onValueChange={onStatusFilterChange}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Alla betalstatus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla betalstatus</SelectItem>
          <SelectItem value="Obetald">Obetald</SelectItem>
          <SelectItem value="Betald">Betald</SelectItem>
          <SelectItem value="Delvis betald">Delvis betald</SelectItem>
          <SelectItem value="Förfallen">Förfallen</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={dateField || 'none'}
        onValueChange={(v) =>
          onDateFieldChange(
            v === 'none' ? ('' as InvoiceDateField) : (v as InvoiceDateField)
          )
        }
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Välj datumtyp" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Välj datumtyp</SelectItem>
          <SelectItem value="invoiceDate">Fakturadatum</SelectItem>
          <SelectItem value="dueDate">Förfallodatum</SelectItem>
          <SelectItem value="paymentDate">Betalningsdatum</SelectItem>
        </SelectContent>
      </Select>

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
