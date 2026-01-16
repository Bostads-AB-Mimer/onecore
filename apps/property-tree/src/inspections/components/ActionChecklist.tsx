import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/v2/Label'
import {
  ACTION_OPTIONS_BY_TYPE,
  type ComponentType,
} from '@/inspections/constants'

interface ActionChecklistProps {
  componentType: ComponentType
  selectedActions: string[]
  onActionToggle: (action: string) => void
}

export function ActionChecklist({
  componentType,
  selectedActions,
  onActionToggle,
}: ActionChecklistProps) {
  const actions = ACTION_OPTIONS_BY_TYPE[componentType]

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div key={action.value} className="flex items-center space-x-2">
          <Checkbox
            id={action.value}
            checked={selectedActions.includes(action.value)}
            onCheckedChange={() => onActionToggle(action.value)}
          />
          <Label
            htmlFor={action.value}
            className="text-sm font-normal cursor-pointer"
          >
            {action.label}
          </Label>
        </div>
      ))}
    </div>
  )
}
