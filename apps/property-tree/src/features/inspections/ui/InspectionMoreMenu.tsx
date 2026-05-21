import { useState } from 'react'
import { FileImage, MoreHorizontal, Plus } from 'lucide-react'

import type { Room } from '@/services/types'

import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'
import { FloorplanImage } from '@/shared/ui/FloorplanImage'

import { AddInspectionRoomDialog } from './AddInspectionRoomDialog'

interface InspectionMoreMenuProps {
  rentalId?: string
  // Inspection id is required for the "Lägg till rum/utrymme" action — without
  // it the button is hidden (caller is in a flow that doesn't have an
  // inspection yet, e.g. create dialog).
  inspectionId?: string
  onRoomAdded?: (room: Room) => void
  // `menu` renders a single icon trigger with a dropdown — used on mobile
  // where the bottom bar is tight. `buttons` renders each action as its own
  // labeled button, used on desktop where there is room for captions.
  variant?: 'menu' | 'buttons'
}

export function InspectionMoreMenu({
  rentalId,
  inspectionId,
  onRoomAdded,
  variant = 'menu',
}: InspectionMoreMenuProps) {
  const [showFloorplan, setShowFloorplan] = useState(false)
  const [showAddRoom, setShowAddRoom] = useState(false)

  const canAddRoom = Boolean(inspectionId && onRoomAdded)

  return (
    <>
      {variant === 'buttons' ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFloorplan(true)}>
            <FileImage className="h-4 w-4" />
            Se planritning
          </Button>
          {canAddRoom && (
            <Button variant="outline" onClick={() => setShowAddRoom(true)}>
              <Plus className="h-4 w-4" />
              Lägg till rum/utrymme
            </Button>
          )}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Fler alternativ</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem
              onSelect={() => setShowFloorplan(true)}
              className="py-3 text-base"
            >
              Se planritning
            </DropdownMenuItem>
            {canAddRoom && (
              <DropdownMenuItem
                onSelect={() => setShowAddRoom(true)}
                className="py-3 text-base"
              >
                Lägg till rum/utrymme
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={showFloorplan} onOpenChange={setShowFloorplan}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-2 sm:p-4">
          <DialogHeader>
            <DialogTitle>Planritning</DialogTitle>
          </DialogHeader>
          <FloorplanImage
            rentalId={rentalId}
            className="w-full h-auto max-h-[80vh] object-contain rounded"
          />
        </DialogContent>
      </Dialog>

      {canAddRoom && inspectionId && onRoomAdded && (
        <AddInspectionRoomDialog
          inspectionId={inspectionId}
          open={showAddRoom}
          onOpenChange={setShowAddRoom}
          onRoomAdded={onRoomAdded}
        />
      )}
    </>
  )
}