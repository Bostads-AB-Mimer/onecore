import { Button } from '@/components/ui/v2/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { useClipboardCopy } from '@/components/hooks/useClipboardCopy'
import { useToast } from '@/components/hooks/useToast'
import { Copy, Check } from 'lucide-react'

interface CopyableFieldProps {
  label: string
  value: string | undefined
  emptyText?: string
}

export function CopyableField({
  label,
  value,
  emptyText = '-',
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
      </div>
    </div>
  )
}
