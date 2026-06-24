import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { SearchableSelect } from '@/shared/ui/SearchableSelect'

interface Steward {
  id: string
  name: string
  employeeId?: string
  phone?: string
}

interface StewardAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kvvArea: string
  currentSteward: Steward
  allStewards: Steward[]
  onAssign: (newStewardId: string) => void
}

export function StewardAssignmentDialog({
  open,
  onOpenChange,
  kvvArea,
  currentSteward,
  allStewards,
  onAssign,
}: StewardAssignmentDialogProps) {
  const [selectedSteward, setSelectedSteward] =
    useState<Steward>(currentSteward)

  const handleSave = () => {
    if (selectedSteward.id !== currentSteward.id) {
      onAssign(selectedSteward.id)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Byt ansvarig för område {kvvArea}</DialogTitle>
          <DialogDescription>
            Välj en ny kvartersvärd som ska vara ansvarig för detta område. Alla
            fastigheter i området kommer att flyttas till den nya
            kvartersvärdaren.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">Kvartersvärd</label>
          <SearchableSelect
            items={allStewards}
            value={selectedSteward}
            onChange={setSelectedSteward}
            getKey={(steward) => steward.id}
            getLabel={(steward) =>
              steward.employeeId
                ? `${steward.name} (${steward.employeeId})`
                : steward.name
            }
            getSearchValue={(steward) =>
              `${steward.name} ${steward.employeeId ?? ''}`
            }
            placeholder="Välj kvartersvärd..."
            searchPlaceholder="Sök kvartersvärd..."
            emptyText="Ingen kvartersvärd hittades."
            contentClassName="z-50"
            renderItem={(steward) => (
              <div className="flex flex-col">
                <span>{steward.name}</span>
                {(steward.employeeId || steward.phone) && (
                  <span className="opacity-70 text-xs">
                    {steward.employeeId}
                    {steward.employeeId && steward.phone && ' • '}
                    {steward.phone}
                  </span>
                )}
              </div>
            )}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedSteward.id === currentSteward.id}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
