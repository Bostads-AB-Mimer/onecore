import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/Command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'

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
  const [selectedSteward, setSelectedSteward] = useState<string>(
    currentSteward.id
  )
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleSave = () => {
    if (selectedSteward !== currentSteward.id) {
      onAssign(selectedSteward)
    }
    onOpenChange(false)
  }

  const selectedStewardData = allStewards.find((s) => s.id === selectedSteward)

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
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={popoverOpen}
                className="w-full justify-between"
              >
                {selectedStewardData ? (
                  <span>
                    {selectedStewardData.name}
                    {selectedStewardData.employeeId
                      ? ` (${selectedStewardData.employeeId})`
                      : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Välj kvartersvärd...
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0 z-50" align="start">
              <Command>
                <CommandInput placeholder="Sök kvartersvärd..." />
                <CommandList>
                  <CommandEmpty>Ingen kvartersvärd hittades.</CommandEmpty>
                  <CommandGroup>
                    {allStewards.map((steward) => (
                      <CommandItem
                        key={steward.id}
                        value={`${steward.name} ${steward.employeeId ?? ''}`}
                        onSelect={() => {
                          setSelectedSteward(steward.id)
                          setPopoverOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedSteward === steward.id
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
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
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedSteward === currentSteward.id}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
