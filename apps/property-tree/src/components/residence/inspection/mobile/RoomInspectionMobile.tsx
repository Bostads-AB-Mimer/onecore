import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v2/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import type { Room } from '@/services/types'
import type { InspectionRoom } from '@/components/residence/inspection/types'

interface RoomInspectionMobileProps {
  room: Room
  inspectionData: InspectionRoom
  onConditionUpdate: (
    field: keyof InspectionRoom['conditions'],
    value: string
  ) => void
  onActionUpdate: (
    field: keyof InspectionRoom['actions'],
    action: string
  ) => void
  onComponentNoteUpdate: (
    field: keyof InspectionRoom['componentNotes'],
    note: string
  ) => void
}

const CONDITION_OPTIONS = [
  {
    value: 'god',
    label: 'God',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle2,
  },
  {
    value: 'acceptabel',
    label: 'Acceptabel',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertCircle,
  },
  {
    value: 'skadad',
    label: 'Skadad',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
]

const COMPONENTS = [
  { key: 'wall1', label: 'Vägg 1' },
  { key: 'wall2', label: 'Vägg 2' },
  { key: 'wall3', label: 'Vägg 3' },
  { key: 'wall4', label: 'Vägg 4' },
  { key: 'floor', label: 'Golv' },
  { key: 'ceiling', label: 'Tak' },
  { key: 'details', label: 'Detaljer' },
] as const

export function RoomInspectionMobile({
  room,
  inspectionData,
  onConditionUpdate,
  onActionUpdate,
  onComponentNoteUpdate,
}: RoomInspectionMobileProps) {
  const getConditionIcon = (condition: string) => {
    const option = CONDITION_OPTIONS.find((opt) => opt.value === condition)
    const Icon = option?.icon || CheckCircle2
    return <Icon className="h-4 w-4" />
  }

  const getConditionColor = (condition: string) => {
    const option = CONDITION_OPTIONS.find((opt) => opt.value === condition)
    return option?.color || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {room.name}
            <Badge variant="outline" className="ml-auto">
              {room.size} m²
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {COMPONENTS.map((component) => {
            const condition = inspectionData?.conditions[component.key] || ''
            const notes = inspectionData?.componentNotes[component.key] || ''

            return (
              <div key={component.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{component.label}</h4>
                  {condition && (
                    <Badge
                      className={`${getConditionColor(condition)} flex items-center gap-1`}
                    >
                      {getConditionIcon(condition)}
                      {
                        CONDITION_OPTIONS.find((opt) => opt.value === condition)
                          ?.label
                      }
                    </Badge>
                  )}
                </div>

                {/* Condition Selection Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {CONDITION_OPTIONS.map((option) => {
                    const isSelected = condition === option.value
                    const Icon = option.icon

                    return (
                      <Button
                        key={option.value}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className={`h-auto py-3 flex flex-col items-center gap-1 ${
                          isSelected ? '' : 'hover:bg-gray-50'
                        }`}
                        onClick={() =>
                          onConditionUpdate(component.key, option.value)
                        }
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    )
                  })}
                </div>

                {/* Notes */}
                <Textarea
                  placeholder={`Anteckningar för ${component.label.toLowerCase()}...`}
                  value={notes}
                  onChange={(e) =>
                    onComponentNoteUpdate(component.key, e.target.value)
                  }
                  className="min-h-[60px] text-sm"
                />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
