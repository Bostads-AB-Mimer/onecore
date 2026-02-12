import { Button } from '@/shared/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/Tooltip'
import { useClipboardCopy } from '@/shared/hooks/useClipboardCopy'
import { useToast } from '@/shared/hooks/useToast'
import { Copy, Check } from 'lucide-react'

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
  const { toast } = useToast()
  const { copyToClipboard, isCopied } = useClipboardCopy({
    onSuccess: () => {
      toast({
        title: 'Kopierad!',
        description: `${label} kopierades till urklipp`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Kunde inte kopiera',
        description: error.message,
      })
    },
  })

  const displayValue = value || emptyText
  const canCopy = !!value

  const handleCopy = () => {
    if (canCopy) {
      copyToClipboard(value)
    }
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className="font-medium">{displayValue}</p>
        {canCopy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="h-6 w-6 shrink-0"
                aria-label={`Kopiera ${label}`}
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Klicka för att kopiera</TooltipContent>
          </Tooltip>
        )}
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
