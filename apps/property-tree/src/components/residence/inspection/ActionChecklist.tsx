import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/v2/Label'

interface ActionChecklistProps {
  componentType: 'walls' | 'floor' | 'ceiling' | 'details'
  selectedActions: string[]
  onActionToggle: (action: string) => void
}

const ACTION_OPTIONS = {
  walls: [
    { value: 'painting', label: 'Målning' },
    { value: 'repair', label: 'Reparation' },
    { value: 'spackling', label: 'Spackling' },
    { value: 'wallpapering', label: 'Tapetsering' },
  ],
  ceiling: [
    { value: 'painting', label: 'Målning' },
    { value: 'repair', label: 'Reparation' },
    { value: 'spackling', label: 'Spackling' },
    { value: 'wallpapering', label: 'Tapetsering' },
  ],
  floor: [
    { value: 'repair', label: 'Reparation' },
    { value: 'replacement', label: 'Byte' },
    { value: 'sanding', label: 'Slipning' },
    { value: 'varnishing', label: 'Lackering' },
  ],
  details: [
    { value: 'repair', label: 'Reparation' },
    { value: 'replacement', label: 'Byte' },
    { value: 'adjustment', label: 'Justering' },
  ],
}

export function ActionChecklist({
  componentType,
  selectedActions,
  onActionToggle,
}: ActionChecklistProps) {
  const actions = ACTION_OPTIONS[componentType]

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
