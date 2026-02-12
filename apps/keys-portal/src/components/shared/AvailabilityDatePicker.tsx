import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  availableDate: Date | undefined
  onDateChange: (date: Date | undefined) => void
  label?: string
  helperText?: string
}

/**
 * Reusable date picker for setting when keys become available to next tenant.
 * Used in return keys flows.
 */
export function AvailabilityDatePicker({
  availableDate,
  onDateChange,
  label = 'Välj datum när nycklarna blir tillgängliga för nästa hyresgäst:',
  helperText = 'Inget datum valt',
}: Props) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !availableDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {availableDate ? (
              format(availableDate, 'PPP')
            ) : (
              <span>Välj datum</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={availableDate}
            onSelect={onDateChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {!availableDate && (
        <div className="text-xs text-muted-foreground">{helperText}</div>
      )}
    </div>
  )
}
