import { Clock } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/shared/ui/Avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import {
  INSPECTION_TYPE,
  INSPECTION_TYPE_RADIO_LABELS,
  type InspectionType,
} from '../constants/inspectionTypes'
import { useInspectors } from '../hooks/useInspectors'

interface InspectionDetailsCardProps {
  inspectorName: string
  setInspectorName: (name: string) => void
  inspectionTime: string
  setInspectionTime: (time: string) => void
  inspectionType: InspectionType
  setInspectionType: (type: InspectionType) => void
}

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')

// Hours 00–23 and minutes at 5-minute granularity. The picker is two Selects
// joined by a colon (matches the new design); state stays a single "HH:MM"
// string so consumers can drop it straight into a Date without parsing.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0')
)
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) =>
  (i * 5).toString().padStart(2, '0')
)

const INSPECTION_TYPE_OPTIONS: InspectionType[] = [
  INSPECTION_TYPE.MOVE_OUT,
  INSPECTION_TYPE.MAINTENANCE,
]

export function InspectionDetailsCard({
  inspectorName,
  setInspectorName,
  inspectionTime,
  setInspectionTime,
  inspectionType,
  setInspectionType,
}: InspectionDetailsCardProps) {
  const { data: inspectors, isLoading: isLoadingInspectors } = useInspectors()

  const [hour, minute] = (inspectionTime || '09:00').split(':')

  const handleHourChange = (next: string) => {
    setInspectionTime(`${next}:${minute}`)
  }
  const handleMinuteChange = (next: string) => {
    setInspectionTime(`${hour}:${next}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Info om besiktning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Besiktigare</Label>
          <Select value={inspectorName} onValueChange={setInspectorName}>
            <SelectTrigger className="w-full" disabled={isLoadingInspectors}>
              <SelectValue placeholder="Välj besiktigare">
                {inspectorName && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(inspectorName)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{inspectorName}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {inspectors?.map((user) => {
                const name = `${user.firstName} ${user.lastName}`
                return (
                  <SelectItem key={user.id} value={name}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      {name}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Klockslag
          </Label>
          <div className="flex items-center gap-2">
            <Select value={hour} onValueChange={handleHourChange}>
              <SelectTrigger className="w-full" aria-label="Timme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground" aria-hidden>
              :
            </span>
            <Select value={minute} onValueChange={handleMinuteChange}>
              <SelectTrigger className="w-full" aria-label="Minut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Typ av besiktning</legend>
          <div className="space-y-2">
            {INSPECTION_TYPE_OPTIONS.map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="inspection-type"
                  value={value}
                  checked={inspectionType === value}
                  onChange={() => setInspectionType(value)}
                  className="h-4 w-4 cursor-pointer"
                />
                {INSPECTION_TYPE_RADIO_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  )
}
