import { useState, useEffect } from 'react'
import type { KeyDetails } from '@/services/types'
import {
  KeyTypeLabels,
  KeyEventTypeLabels,
  KeyEventStatusLabels,
  type KeyEventType,
  type KeyEventStatus,
} from '@/services/types'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { getLatestActiveEvent } from '@/components/shared/tables/StatusBadges'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyData: KeyDetails
  onSuccess?: () => void
}

const eventTypeOptions: { value: KeyEventType; label: string }[] = [
  { value: 'LOST', label: KeyEventTypeLabels.LOST },
  { value: 'FLEX', label: KeyEventTypeLabels.FLEX },
  { value: 'ORDER', label: KeyEventTypeLabels.ORDER },
  { value: 'REPLACEMENT', label: KeyEventTypeLabels.REPLACEMENT },
]

const statusOptions: { value: KeyEventStatus; label: string }[] = [
  { value: 'ORDERED', label: KeyEventStatusLabels.ORDERED },
  { value: 'RECEIVED', label: KeyEventStatusLabels.RECEIVED },
  { value: 'COMPLETED', label: KeyEventStatusLabels.COMPLETED },
]

export function KeyEventMenu({
  open,
  onOpenChange,
  keyData,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const activeEvent = getLatestActiveEvent(keyData)
  const isEditMode = !!activeEvent

  const [selectedType, setSelectedType] = useState<KeyEventType | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<KeyEventStatus>('ORDERED')

  // Reset state when dialog opens or key changes
  useEffect(() => {
    if (open) {
      if (activeEvent) {
        setSelectedStatus(activeEvent.status)
      } else {
        setSelectedType('')
        setSelectedStatus('ORDERED')
      }
    }
  }, [open, keyData.id])

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      if (isEditMode && activeEvent) {
        // Update existing event status
        const eventId = keyData.events?.[0]?.id
        if (!eventId) throw new Error('Event ID not found')

        await keyEventService.updateStatus(eventId, selectedStatus)

        const statusLabel = KeyEventStatusLabels[selectedStatus].toLowerCase()
        toast({
          title: 'Status uppdaterad',
          description: `${keyData.keyName} har uppdaterats till ${statusLabel}.`,
        })
      } else {
        // Create new event
        if (!selectedType) return

        await keyEventService.create({
          keys: [keyData.id],
          type: selectedType,
          status: 'ORDERED',
        })

        const typeLabel = KeyEventTypeLabels[selectedType].toLowerCase()
        toast({
          title: 'Händelse skapad',
          description: `${keyData.keyName} har markerats som ${typeLabel}.`,
        })
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Okänt fel'
      toast({
        title: isEditMode
          ? 'Kunde inte uppdatera status'
          : 'Kunde inte skapa händelse',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const canConfirm = isEditMode
    ? selectedStatus !== activeEvent?.status
    : selectedType !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Ändra händelsestatus' : 'Skapa händelse'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Ändra status för händelse på denna nyckel.'
              : 'Välj händelsetyp för denna nyckel.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key info */}
          <div className="p-3 border rounded-lg bg-card">
            <div className="font-medium text-sm">{keyData.keyName}</div>
            <div className="text-xs text-muted-foreground">
              {KeyTypeLabels[keyData.keyType as keyof typeof KeyTypeLabels]}
              {keyData.keySequenceNumber !== undefined &&
                ` • Löpnr: ${keyData.keySequenceNumber}`}
            </div>
          </div>

          {isEditMode && activeEvent ? (
            /* Edit mode: show current type, allow status change */
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Händelsetyp</Label>
                <div className="mt-1">
                  <Badge
                    variant={
                      activeEvent.type === 'LOST' ? 'destructive' : 'outline'
                    }
                  >
                    {KeyEventTypeLabels[activeEvent.type]}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Status</Label>
                <RadioGroup
                  value={selectedStatus}
                  onValueChange={(v) =>
                    setSelectedStatus(v as KeyEventStatus)
                  }
                  className="mt-2"
                >
                  {statusOptions.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={opt.value} />
                      <Label htmlFor={opt.value} className="cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          ) : (
            /* Create mode: select event type */
            <div>
              <Label className="text-sm font-medium">Händelsetyp</Label>
              <RadioGroup
                value={selectedType}
                onValueChange={(v) => setSelectedType(v as KeyEventType)}
                className="mt-2"
              >
                {eventTypeOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value} className="cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
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
            onClick={handleConfirm}
            disabled={isProcessing || !canConfirm}
            variant={
              !isEditMode && selectedType === 'LOST' ? 'destructive' : 'default'
            }
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {isEditMode ? 'Uppdaterar...' : 'Skapar...'}
              </>
            ) : isEditMode ? (
              'Uppdatera status'
            ) : (
              'Skapa händelse'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
