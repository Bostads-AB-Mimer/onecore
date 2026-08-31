import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ROOM_CAPTION_TEMPLATES, ALL_VALID_TYPE_CODES } from '@onecore/types'

import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import { inspectionService } from '@/services/api/core/inspectionService'
import type { Room } from '@/services/types'

interface AddInspectionRoomDialogProps {
  inspectionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRoomAdded: (room: Room) => void
}

export function AddInspectionRoomDialog({
  inspectionId,
  open,
  onOpenChange,
  onRoomAdded,
}: AddInspectionRoomDialogProps) {
  const queryClient = useQueryClient()
  const [typeCode, setTypeCode] = useState<string>('')
  const [caption, setCaption] = useState<string | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedTemplate = ROOM_CAPTION_TEMPLATES.find(
    (t) => t.typeCode === typeCode
  )
  const captionOptions = selectedTemplate?.captionOptions ?? []
  const showCaptionPicker = captionOptions.length > 1

  const mutation = useMutation({
    mutationFn: async () => {
      if (!typeCode) throw new Error('Välj en rumstyp')
      return inspectionService.addInspectionRoom(inspectionId, {
        roomTypeCode: typeCode as (typeof ALL_VALID_TYPE_CODES)[number],
        ...(showCaptionPicker && caption ? { caption } : {}),
      })
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({
        queryKey: ['inspections-internal', inspectionId],
      })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      onRoomAdded(room)
      onOpenChange(false)
      setTypeCode('')
      setCaption(undefined)
      setErrorMessage(null)
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : 'Kunde inte lägga till rummet'
      setErrorMessage(message)
      // Refetch on failure: the property-service write may have succeeded
      // with the response lost in transit. If the room actually got created
      // in Xpand, refreshing surfaces it via the inspection's room list.
      queryClient.invalidateQueries({
        queryKey: ['inspections-internal', inspectionId],
      })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setErrorMessage(null)
      mutation.reset()
    }
  }

  const handleSubmit = () => {
    setErrorMessage(null)
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Lägg till rum/utrymme</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="room-type">Rumstyp</Label>
            <Select
              value={typeCode}
              onValueChange={(value) => {
                setTypeCode(value)
                setCaption(undefined)
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="room-type">
                <SelectValue placeholder="Välj typ..." />
              </SelectTrigger>
              <SelectContent>
                {[...ROOM_CAPTION_TEMPLATES]
                  .sort((a, b) => a.typeLabel.localeCompare(b.typeLabel, 'sv'))
                  .map((t) => (
                    <SelectItem key={t.typeCode} value={t.typeCode}>
                      {t.typeLabel}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {showCaptionPicker && (
            <div className="space-y-1.5">
              <Label htmlFor="room-caption">Benämning</Label>
              <Select
                value={caption ?? captionOptions[0]}
                onValueChange={setCaption}
                disabled={mutation.isPending}
              >
                <SelectTrigger id="room-caption">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {captionOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!typeCode || mutation.isPending}
          >
            {mutation.isPending ? 'Lägger till...' : 'Lägg till'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
