import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import type { ScheduleConfig } from '@/services/api/core/communicationService'

import {
  formatSlotTime,
  getSlotsForDay,
  isDayDisabled,
  startOfDay,
} from '@/shared/lib/schedule'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import { Calendar } from '@/shared/ui/Calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

interface ScheduleDateTimePickerProps {
  value: Date | null
  onChange: (value: Date | null) => void
  config: ScheduleConfig
  disabled?: boolean
  className?: string
}

// Date picker + time dropdown for a scheduled send: the calendar greys out
// past days and days beyond max-ahead, the dropdown lists only the open
// 10-minute slots of the chosen day (no blocked hours, no past slots).
export function ScheduleDateTimePicker({
  value,
  onChange,
  config,
  disabled,
  className,
}: ScheduleDateTimePickerProps) {
  const day = value ? startOfDay(value) : undefined
  const slots = day ? getSlotsForDay(day, config) : []
  const time = value ? formatSlotTime(value) : ''

  const handleDaySelect = (selected: Date | undefined) => {
    if (!selected) {
      onChange(null)
      return
    }
    const daySlots = getSlotsForDay(selected, config)
    // Keep the chosen time when the new day offers it; otherwise fall back to
    // the first open slot so the field stays valid.
    const kept = daySlots.find((s) => formatSlotTime(s) === time)
    onChange(kept ?? daySlots[0] ?? null)
  }

  const handleTimeSelect = (selectedTime: string) => {
    if (!day) return
    const [h, m] = selectedTime.split(':').map(Number)
    onChange(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-[180px] justify-start text-left font-normal',
              !day && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {day ? format(day, 'd MMMM yyyy', { locale: sv }) : 'Välj datum'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={day}
            onSelect={handleDaySelect}
            disabled={(date) => isDayDisabled(date, config)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Select
        value={time}
        onValueChange={handleTimeSelect}
        disabled={disabled || !day || slots.length === 0}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Tid" />
        </SelectTrigger>
        <SelectContent>
          {slots.map((slot) => {
            const label = formatSlotTime(slot)
            return (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      {day && slots.length === 0 && (
        <span className="text-sm text-muted-foreground">
          Inga lediga tider den här dagen
        </span>
      )}
    </div>
  )
}
