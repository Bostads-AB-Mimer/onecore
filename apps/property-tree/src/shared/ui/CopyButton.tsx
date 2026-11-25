import { Check, Copy } from 'lucide-react'

import { useClipboardCopy } from '@/shared/hooks/useClipboardCopy'
import { useToast } from '@onecore/ui'
import { Button } from '@/shared/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/Tooltip'

interface CopyButtonProps {
  label: string
  value: string
}

export function CopyButton({ label, value }: CopyButtonProps) {
  const { toast } = useToast()
  const { copyToClipboard, isCopied } = useClipboardCopy({
    onSuccess: () => {
      toast({
        title: 'Kopierad!',
        description: `${label} kopierades till urklipp`,
      })
    },
    onError: () => {
      toast({
        title: 'Kunde inte kopiera',
        description: 'Markera och kopiera texten manuellt.',
        variant: 'destructive',
      })
    },
  })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => copyToClipboard(value)}
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
  )
}
