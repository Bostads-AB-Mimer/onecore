import { useState } from 'react'
import { FileImage, MoreHorizontal, Plus } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'

interface InspectionMoreMenuProps {
  rentalId?: string
  onAddRoom?: (name: string) => void
  // `menu` renders a single icon trigger with a dropdown — used on mobile
  // where the bottom bar is tight. `buttons` renders each action as its own
  // labeled button, used on desktop where there is room for captions.
  variant?: 'menu' | 'buttons'
}

export function InspectionMoreMenu({
  rentalId,
  onAddRoom,
  variant = 'menu',
}: InspectionMoreMenuProps) {
  const [showFloorplan, setShowFloorplan] = useState(false)
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  const handleAddRoom = () => {
    if (newRoomName.trim()) {
      onAddRoom?.(newRoomName.trim())
      setNewRoomName('')
      setShowAddRoom(false)
    }
  }

  return (
    <>
      {variant === 'buttons' ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFloorplan(true)}>
            <FileImage className="h-4 w-4" />
            Se planritning
          </Button>
          {onAddRoom && (
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
            {onAddRoom && (
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

      {/* Floorplan Dialog */}
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

      {/* Add Room Dialog */}
      {onAddRoom && (
        <Dialog open={showAddRoom} onOpenChange={setShowAddRoom}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Lägg till rum/utrymme</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="new-room-name">Namn</Label>
              <Input
                id="new-room-name"
                placeholder="t.ex. Klädkammare, Entré..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRoom()
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddRoom(false)}>
                Avbryt
              </Button>
              <Button onClick={handleAddRoom} disabled={!newRoomName.trim()}>
                Lägg till
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
