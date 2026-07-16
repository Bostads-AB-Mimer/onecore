import { CalendarClock } from 'lucide-react'

import type { ScheduleFieldState } from '@/shared/hooks/useScheduleField'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'

// The "Schemalägg utskick" checkbox + datetime picker used by the send
// modals. State and validation live in useScheduleField.
export function ScheduleField({
  id,
  field,
}: {
  id: string
  field: ScheduleFieldState
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={field.isScheduling}
          onCheckedChange={(checked) => field.toggle(checked === true)}
        />
        <Label
          htmlFor={id}
          className="text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <CalendarClock className="h-4 w-4" />
          Schemalägg utskick
        </Label>
      </div>
      {field.isScheduling && (
        <div className="mt-2">
          <Input
            type="datetime-local"
            value={field.sendAtLocal}
            onChange={(e) => field.setSendAtLocal(e.target.value)}
            min={field.bounds.min}
            max={field.bounds.max}
          />
          {field.error && (
            <p className="mt-1 text-sm text-destructive">{field.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
