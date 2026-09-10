import { useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { type TenantSearchResult, useTenantSearch } from '@/entities/tenant'

import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/utils'
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
  GUARDIAN_ROLE_LABELS,
  GUARDIAN_ROLE_TYPES,
  type GuardianRoleType,
  relationErrorMessage,
} from '../lib/guardians'

interface AddGuardianDialogProps {
  /** The contact the guardian is added to (huvudman). */
  contactCode: string
}

export const AddGuardianDialog = ({ contactCode }: AddGuardianDialogProps) => {
  const [open, setOpen] = useState(false)
  const [roleType, setRoleType] = useState<GuardianRoleType>('god_man')
  const [selected, setSelected] = useState<TenantSearchResult | null>(null)
  const { toast } = useToast()
  const addRelation = useAddRelation()
  const search = useTenantSearch()

  const close = () => {
    setOpen(false)
    setRoleType('god_man')
    setSelected(null)
    search.setSearchQuery('')
  }

  // Closing mid-flight would drop the pending add without telling anyone, so
  // the overlay, the X and Escape are all inert until the mutation settles.
  const handleOpenChange = (next: boolean) => {
    if (!next && addRelation.isPending) return
    if (next) setOpen(true)
    else close()
  }

  const submit = () => {
    if (!selected) return
    addRelation.mutate(
      { contactCode, relatedContactCode: selected.contactCode, roleType },
      {
        onSuccess: () => {
          close()
          toast({
            title: `${GUARDIAN_ROLE_LABELS[roleType]} tillagd`,
            description: `${selected.fullName} (${selected.contactCode})`,
          })
        },
        onError: (error) =>
          toast({
            variant: 'destructive',
            title: 'Kunde inte lägga till',
            description: relationErrorMessage(error?.error, error?.detail),
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
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (addRelation.isPending) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Lägg till god man eller förvaltare</DialogTitle>
          <DialogDescription>
            Sök bland befintliga kontakter. En kontakt kan bara ha en god man
            eller förvaltare åt gången.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guardian-role">Roll</Label>
            <Select
              value={roleType}
              onValueChange={(value) => setRoleType(value as GuardianRoleType)}
            >
              <SelectTrigger id="guardian-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GUARDIAN_ROLE_TYPES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {GUARDIAN_ROLE_LABELS[role]}
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
                    className={cn(
                      'w-full text-left p-2 hover:bg-muted',
                      selected?.contactCode === candidate.contactCode &&
                        'bg-muted font-medium'
                    )}
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
            onClick={close}
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
