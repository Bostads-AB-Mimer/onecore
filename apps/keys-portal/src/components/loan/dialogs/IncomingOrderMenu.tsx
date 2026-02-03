import { useState, useMemo, useEffect } from 'react'
import type { Key, KeyEvent } from '@/services/types'
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
import { Loader2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKeys: Key[]
  onSuccess?: () => void
}

export function IncomingOrderMenu({
  open,
  onOpenChange,
  selectedKeys,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [keyEvents, setKeyEvents] = useState<Map<string, KeyEvent>>(new Map())

  // Fetch events for selected keys
  useEffect(() => {
    if (!open || selectedKeys.length === 0) return

    const fetchEvents = async () => {
      setIsLoadingEvents(true)
      try {
        const keyIds = selectedKeys.map((k) => k.id)
        const eventMap = await keyEventService.getLatestForKeys(keyIds)
        setKeyEvents(eventMap)
      } catch (error) {
        console.error('Failed to fetch key events:', error)
      } finally {
        setIsLoadingEvents(false)
      }
    }

    fetchEvents()
  }, [open, selectedKeys])

  // Filter keys that have ORDER type with ORDERED status
  const validOrderKeys = useMemo(() => {
    return selectedKeys.filter((key) => {
      const latestEvent = keyEvents.get(key.id)
      return (
        latestEvent &&
        latestEvent.type === 'ORDER' &&
        latestEvent.status === 'ORDERED'
      )
    })
  }, [selectedKeys, keyEvents])

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      const eventIdsToUpdate = new Set<string>()

      // Collect all event IDs that need to be updated
      validOrderKeys.forEach((key) => {
        const event = keyEvents.get(key.id)
        if (event?.id) {
          eventIdsToUpdate.add(event.id)
        }
      })

      // Update all events from ORDERED to RECEIVED
      await Promise.all(
        Array.from(eventIdsToUpdate).map((eventId) =>
          keyEventService.updateStatus(eventId, 'RECEIVED')
        )
      )

      toast({
        title: 'Extranycklar inkomna',
        description: `${validOrderKeys.length} extranyckel/extranycklar har markerats som inkomna.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: 'Kunde inte markera extranycklar som inkomna',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoadingEvents) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Inkommen extranyckel</DialogTitle>
            <DialogDescription>Laddar händelser...</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (validOrderKeys.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Inkommen extranyckel</DialogTitle>
            <DialogDescription>
              Inga beställda extranycklar valda (nycklar måste ha status
              "Beställd").
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Inkommen extranyckel</DialogTitle>
          <DialogDescription>
            Markera följande extranycklar som inkomna:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {validOrderKeys.map((key) => (
            <div
              key={key.id}
              className="p-3 border rounded-lg bg-card flex items-center gap-3"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{key.keyName}</div>
                <div className="text-xs text-muted-foreground">
                  {KeyTypeLabels[key.keyType]}
                  {key.keySequenceNumber !== undefined &&
                    ` • Sekv: ${key.keySequenceNumber}`}
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
          <Button onClick={handleAccept} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bearbetar...
              </>
            ) : (
              `Markera som inkommen (${validOrderKeys.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
