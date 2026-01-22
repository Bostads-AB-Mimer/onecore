import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Calendar } from '@/components/ui/Calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'

interface DateRangeFilterDropdownProps {
  /** Start date (YYYY-MM-DD string or null) */
  startDate: string | null
  /** End date (YYYY-MM-DD string or null) */
  endDate: string | null
  /** Called when date range changes */
  onDateChange: (startDate: string | null, endDate: string | null) => void
  /** Placeholder text when no dates selected */
  placeholder?: string
  className?: string
}

/**
 * A date range picker dropdown using Calendar component.
 * Allows selecting a start and end date.
 */
export function DateRangeFilterDropdown({
  startDate,
  endDate,
  onDateChange,
  placeholder = 'Välj datum...',
  className,
}: DateRangeFilterDropdownProps) {
  const [open, setOpen] = useState(false)

  // Convert string dates to Date objects for the calendar
  const selectedRange: DateRange | undefined =
    startDate || endDate
      ? {
          from: startDate ? new Date(startDate) : undefined,
          to: endDate ? new Date(endDate) : undefined,
        }
      : undefined

  const hasDateFilter = startDate !== null || endDate !== null

  // Format display text
  const getDisplayText = () => {
    if (!startDate && !endDate) return placeholder

    const formatDate = (dateStr: string) => {
      return format(new Date(dateStr), 'd MMM yyyy', { locale: sv })
    }

    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`
    }
    if (startDate) {
      return `Från ${formatDate(startDate)}`
    }
    if (endDate) {
      return `Till ${formatDate(endDate)}`
    }
    return placeholder
  }

  const handleSelect = (range: DateRange | undefined) => {
    const newStartDate = range?.from
      ? format(range.from, 'yyyy-MM-dd')
      : null
    const newEndDate = range?.to ? format(range.to, 'yyyy-MM-dd') : null

    onDateChange(newStartDate, newEndDate)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDateChange(null, null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 min-w-[180px] px-3 font-semibold justify-between',
            hasDateFilter && 'text-primary border-primary',
            className
          )}
        >
          <span className="truncate text-left flex-1">{getDisplayText()}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {hasDateFilter && (
              <X
                className="h-3 w-3 hover:text-destructive"
                onClick={handleClear}
              />
            )}
            <CalendarIcon
              className={cn('h-3 w-3', hasDateFilter && 'text-primary')}
            />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={selectedRange?.from}
          selected={selectedRange}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
        {hasDateFilter && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 justify-start px-2 text-xs"
              onClick={handleClear}
            >
              <X className="h-3 w-3 mr-1" />
              Rensa datum
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
