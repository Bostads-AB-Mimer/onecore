import { Button } from '@/shared/ui/Button'
import { CopyButton } from '@/shared/ui/CopyButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/Tooltip'

interface ActionButton {
  icon: React.ReactNode
  onClick: () => void
  tooltip: string
  ariaLabel: string
}

interface CopyableFieldProps {
  label: string
  value: string | undefined
  emptyText?: string
  actions?: ActionButton[]
}

export function CopyableField({
  label,
  value,
  emptyText = '-',
  actions,
}: CopyableFieldProps) {
  const displayValue = value || emptyText

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className="font-medium">{displayValue}</p>
        {value && <CopyButton label={label} value={value} />}
        {actions?.map((action, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={action.onClick}
                className="h-6 w-6 shrink-0"
                aria-label={action.ariaLabel}
              >
                {action.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{action.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
