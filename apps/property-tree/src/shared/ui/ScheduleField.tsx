import { CalendarClock } from 'lucide-react'

import type { ScheduleFieldState } from '@/shared/hooks/useScheduleField'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Label } from '@/shared/ui/Label'
import { ScheduleDateTimePicker } from '@/shared/ui/ScheduleDateTimePicker'

// The "Schemalägg utskick" checkbox + slot picker used by the send modals.
// State and validation live in useScheduleField. Renders nothing while the
// rules load or when the service has scheduling switched off; a failed rules
// fetch gets its own hint so it never reads as "scheduling off".
export function ScheduleField({
  id,
  field,
}: {
  id: string
  field: ScheduleFieldState
}) {
  if (field.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Kunde inte hämta regler för schemaläggning
      </p>
    )
  }
  if (!field.enabled || !field.config) return null

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
          <ScheduleDateTimePicker
            value={field.sendAt}
            onChange={field.setSendAt}
            config={field.config}
          />
          {field.error && (
            <p className="mt-1 text-sm text-destructive">{field.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
