import { useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { type TenantSearchResult, useTenantSearch } from '@/entities/tenant'

import type { RelationRoleType } from '@/services/api/core/tenantService'

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
  RELATION_ROLE_LABELS,
  relationErrorMessage,
} from '../lib/relationRoles'

interface AddRelationDialogProps {
  /** The contact the relation is added to (huvudman for a guardian). */
  contactCode: string
  /** Non-empty; the caller hides the dialog when nothing can be added. */
  availableRoles: RelationRoleType[]
}

export const AddRelationDialog = ({
  contactCode,
  availableRoles,
}: AddRelationDialogProps) => {
  const [open, setOpen] = useState(false)
  const [roleType, setRoleType] = useState<RelationRoleType>(availableRoles[0])
  const [selected, setSelected] = useState<TenantSearchResult | null>(null)
  const { toast } = useToast()
  const addRelation = useAddRelation()
  const search = useTenantSearch()

  const close = () => {
    setOpen(false)
    setSelected(null)
    search.setSearchQuery('')
  }

  // Closing mid-flight would drop the pending add silently, so the overlay, the
  // X, Escape and the form inputs are all inert until the mutation settles.
  const handleOpenChange = (next: boolean) => {
    if (!next && addRelation.isPending) return
    if (!next) return close()
    // Which roles are on offer depends on what the contact already has, so
    // pick again on open rather than trusting the last selection.
    setRoleType(availableRoles[0])
    setOpen(true)
  }

  const submit = () => {
    if (!selected) return
    addRelation.mutate(
      { contactCode, relatedContactCode: selected.contactCode, roleType },
      {
        onSuccess: () => {
          close()
          toast({
            title: `${RELATION_ROLE_LABELS[roleType]} tillagd`,
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

  const guardianOnOffer = availableRoles.some(
    (role) => role === 'god_man' || role === 'forvaltare'
  )

  // A contact cannot be related to itself; the server rejects it too.
  const candidates = search.searchResults.filter(
    (candidate) => candidate.contactCode !== contactCode
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Lägg till relaterad kontakt
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (addRelation.isPending) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Lägg till relaterad kontakt</DialogTitle>
          <DialogDescription>
            Sök bland befintliga kontakter.
            {guardianOnOffer &&
              ' En kontakt kan bara ha en god man eller förvaltare åt gången.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guardian-role">Roll</Label>
            <Select
              value={roleType}
              onValueChange={(value) => setRoleType(value as RelationRoleType)}
              disabled={addRelation.isPending}
            >
              <SelectTrigger id="guardian-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {RELATION_ROLE_LABELS[role]}
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
              disabled={addRelation.isPending}
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
                    disabled={addRelation.isPending}
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
