import { useState } from 'react'
import { Button } from '@/components/ui/v2/Button'
import { Calendar } from '@/components/ui/Calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { Input } from '@/components/ui/Input'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { components } from '@/services/api/core/generated/api-types'
type Inspection = components['schemas']['Inspection']

interface DateCellProps {
  inspection: Inspection
  readOnly?: boolean
  onUpdate: (id: string, updates: Partial<Inspection>) => void
}

export function DateCell({
  inspection,
  readOnly = false,
  onUpdate,
}: DateCellProps) {
  const inspectionDate = inspection.date ? new Date(inspection.date) : null

  const [timeValue, setTimeValue] = useState(() => {
    if (inspectionDate) {
      const hours = inspectionDate.getHours().toString().padStart(2, '0')
      const minutes = inspectionDate.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return '09:00'
  })

  // Om readOnly, visa bara datumet som text
  if (readOnly) {
    return (
      <span className="text-sm whitespace-nowrap">
        {inspectionDate
          ? format(inspectionDate, 'dd-MM-yyyy HH:mm')
          : 'Ej planerat'}
      </span>
    )
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = timeValue.split(':').map(Number)
      const newDate = new Date(date)
      newDate.setHours(hours, minutes, 0, 0)
      onUpdate(inspection.id, { date: newDate.toISOString() })
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    setTimeValue(newTime)

    if (inspectionDate && /^\d{2}:\d{2}$/.test(newTime)) {
      const [hours, minutes] = newTime.split(':').map(Number)
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const newDate = new Date(inspectionDate)
        newDate.setHours(hours, minutes, 0, 0)
        onUpdate(inspection.id, { date: newDate.toISOString() })
      }
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-52 justify-start text-left font-normal',
            !inspectionDate && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {inspectionDate
              ? format(inspectionDate, 'dd-MM-yyyy HH:mm')
              : 'Välj datum och tid'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={inspectionDate || undefined}
          onSelect={handleDateSelect}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        <div className="p-3 border-t">
          <label className="text-sm font-medium mb-2 block">Klockslag</label>
          <Input
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
