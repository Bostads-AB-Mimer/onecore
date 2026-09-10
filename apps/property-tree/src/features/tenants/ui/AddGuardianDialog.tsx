import { useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { useTenantSearch } from '@/entities/tenant'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import { useAddRelation } from '../hooks/useAddRelation'
import {
  GUARDIAN_ROLE_TYPES,
  guardianRoleLabels,
  type GuardianRoleType,
  relationErrorMessage,
} from '../lib/relations'

interface AddGuardianDialogProps {
  /** The contact the guardian is added to (huvudman). */
  contactCode: string
}

interface Candidate {
  contactCode: string
  fullName: string
}

export const AddGuardianDialog = ({ contactCode }: AddGuardianDialogProps) => {
  const [open, setOpen] = useState(false)
  const [roleType, setRoleType] = useState<GuardianRoleType>('god_man')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const { toast } = useToast()
  const addRelation = useAddRelation()
  const search = useTenantSearch()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setSelected(null)
      search.setSearchQuery('')
      addRelation.reset()
    }
  }

  const submit = () => {
    if (!selected) return
    const chosen = selected
    addRelation.mutate(
      { contactCode, relatedContactCode: chosen.contactCode, roleType },
      {
        onSuccess: () => {
          handleOpenChange(false)
          toast({
            title: `${guardianRoleLabels[roleType]} tillagd`,
            description: `${chosen.fullName} (${chosen.contactCode})`,
          })
        },
        onError: (error) =>
          toast({
            variant: 'destructive',
            title: 'Kunde inte lägga till',
            description: relationErrorMessage(error?.error),
          }),
      }
    )
  }

  // A contact cannot be its own guardian; the server rejects it too.
  const candidates = search.searchResults.filter(
    (candidate) => candidate.contactCode !== contactCode
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Lägg till god man/förvaltare
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lägg till god man eller förvaltare</DialogTitle>
          <DialogDescription>
            Sök bland befintliga kontakter. En kontakt kan bara ha en god man
            eller förvaltare åt gången.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Roll</Label>
            <Select
              value={roleType}
              onValueChange={(value) => setRoleType(value as GuardianRoleType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GUARDIAN_ROLE_TYPES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {guardianRoleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guardian-search">Kontakt</Label>
            <Input
              id="guardian-search"
              placeholder="Sök på namn eller kundnummer (minst 3 tecken)"
              value={search.searchQuery}
              onChange={(event) => {
                search.setSearchQuery(event.target.value)
                setSelected(null)
              }}
            />
            {search.showSearchResults && (
              <div className="max-h-48 overflow-y-auto rounded-md border text-sm">
                {search.isSearching && (
                  <div className="p-2 text-muted-foreground">Söker…</div>
                )}
                {!search.isSearching && candidates.length === 0 && (
                  <div className="p-2 text-muted-foreground">Inga träffar</div>
                )}
                {candidates.map((candidate) => (
                  <button
                    key={candidate.contactCode}
                    type="button"
                    onClick={() => setSelected(candidate)}
                    className={
                      'w-full text-left p-2 hover:bg-muted ' +
                      (selected?.contactCode === candidate.contactCode
                        ? 'bg-muted font-medium'
                        : '')
                    }
                  >
                    {candidate.fullName}{' '}
                    <span className="text-muted-foreground">
                      {candidate.contactCode}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <p className="text-sm">
                Vald: <span className="font-medium">{selected.fullName}</span> (
                {selected.contactCode})
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={addRelation.isPending}
          >
            Avbryt
          </Button>
          <Button
            onClick={submit}
            disabled={!selected || addRelation.isPending}
          >
            {addRelation.isPending ? 'Lägger till...' : 'Lägg till'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
