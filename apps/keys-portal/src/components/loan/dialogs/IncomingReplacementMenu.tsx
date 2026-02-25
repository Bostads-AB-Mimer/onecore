import { useState } from 'react'
import type { KeyDetails } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyEventService } from '@/services/api/keyEventService'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKeys: KeyDetails[]
  onSuccess?: () => void
}

export function IncomingReplacementMenu({
  open,
  onOpenChange,
  selectedKeys,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      // Get event IDs directly from the key objects (already filtered by KeyActionButtons)
      const eventIds = selectedKeys
        .map((key) => key.events?.[0]?.id)
        .filter((id): id is string => !!id)

      await Promise.all(
        eventIds.map((eventId) =>
          keyEventService.updateStatus(eventId, 'RECEIVED')
        )
      )

      toast({
        title: 'Ersättningsnycklar inkomna',
        description: `${selectedKeys.length} ${selectedKeys.length === 1 ? 'ersättningsnyckel har' : 'ersättningsnycklar har'} markerats som inkomna.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: 'Kunde inte markera ersättningsnycklar som inkomna',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inkommen ersättning</DialogTitle>
          <DialogDescription>
            Markera följande ersättningsnycklar som inkomna:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pb-px">
          {selectedKeys.map((key) => (
            <div
              key={key.id}
              className="p-3 border rounded-lg bg-card flex items-center gap-3"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{key.keyName}</div>
                <div className="text-xs text-muted-foreground">
                  {KeyTypeLabels[key.keyType]}
                  {key.keySequenceNumber !== undefined &&
                    ` • Löpnr: ${key.keySequenceNumber}`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isProcessing || selectedKeys.length === 0}
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Bearbetar...
              </>
            ) : (
              `Markera som inkommen (${selectedKeys.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
