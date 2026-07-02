import { Check, Pencil, X } from 'lucide-react'
import { useState } from 'react'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { CopyableField } from '@/shared/ui/CopyableField'
import { Input } from '@/shared/ui/Input'

import { useUpdateMalarEnergiFacilityId } from '../hooks/useUpdateMalarEnergiFacilityId'

const LABEL = 'Anläggnings ID Mälarenergi'

interface MalarEnergiFacilityIdFieldProps {
  rentalId: string | undefined
  value: string | undefined
}

/**
 * Displays the residence's "Anläggnings ID Mälarenergi" and lets the user edit
 * or add it inline. Display mode reuses CopyableField (keeping copy behavior);
 * edit mode swaps in an input with save/cancel.
 */
export function MalarEnergiFacilityIdField({
  rentalId,
  value,
}: MalarEnergiFacilityIdFieldProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const { mutate, isPending } = useUpdateMalarEnergiFacilityId({
    onSuccess: () => {
      toast({ title: 'Sparat', description: `${LABEL} uppdaterades` })
      setIsEditing(false)
    },
    onError: (error) => {
      toast({
        title: 'Kunde inte spara',
        description: error?.message ?? 'Ett oväntat fel uppstod',
      })
    },
  })

  const startEditing = () => {
    setDraft(value ?? '')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const save = () => {
    const trimmed = draft.trim()
    // An empty or unchanged draft intentionally just closes edit mode without
    // writing — the value can be set or updated but not cleared (the shared
    // schema requires min length 1).
    if (!rentalId || !trimmed || trimmed === value) {
      setIsEditing(false)
      return
    }
    mutate({ rentalId, malarEnergiFacilityId: trimmed })
  }

  if (!isEditing) {
    return (
      <CopyableField
        label={LABEL}
        value={value || undefined}
        actions={
          rentalId
            ? [
                {
                  icon: <Pencil className="h-4 w-4" />,
                  onClick: startEditing,
                  tooltip: 'Redigera',
                  ariaLabel: `Redigera ${LABEL}`,
                },
              ]
            : undefined
        }
      />
    )
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">{LABEL}</p>
      <div
        className="flex items-center gap-2"
        onBlur={(e) => {
          // Discard the draft when focus leaves the field entirely (click-away).
          // relatedTarget stays inside when moving to Save/Cancel, so those keep
          // working; skip while a save is in flight.
          if (
            !isPending &&
            !e.currentTarget.contains(e.relatedTarget as Node)
          ) {
            cancelEditing()
          }
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') cancelEditing()
          }}
          disabled={isPending}
          autoFocus
          className="h-8"
          aria-label={LABEL}
        />
        <Button
          variant="ghost"
          size="icon"
          // Safari (incl. iOS) doesn't focus buttons on tap, so without this the
          // container's onBlur discards the draft before onClick fires —
          // cancelling instead of saving. preventDefault keeps focus on input.
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          disabled={isPending}
          className="h-6 w-6 shrink-0"
          aria-label="Spara"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onMouseDown={(e) => e.preventDefault()} // keep focus; see Save button
          onClick={cancelEditing}
          disabled={isPending}
          className="h-6 w-6 shrink-0"
          aria-label="Avbryt"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
