import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { useSetHomeInsuranceEndDate } from '@/entities/lease/hooks/useLeaseRentRows'
import { HOME_INSURANCE_WRITE_ROLE, useHasRole } from '@/entities/user'

import {
  type LeaseRentRow,
  type SetHomeInsuranceEndDateError,
  SetHomeInsuranceEndDateFailed,
} from '@/services/api/core/leaseRentRowService'

import { useToast } from '@/shared/hooks/useToast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/AlertDialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

const ERROR_TEXT: Record<SetHomeInsuranceEndDateError, string> = {
  'lease-not-found': 'Kontraktet finns inte längre.',
  'row-not-found':
    'Raden finns inte längre på kontraktet. Ladda om listan och försök igen.',
  'not-home-insurance': 'Bara hemförsäkringsrader kan ändras.',
  'end-before-start': 'T.o.m. kan inte vara före Fr.o.m.',
  unchanged: 'Raden har redan det datumet.',
  'lease-fetch-failed': 'Kontraktet kunde inte hämtas. Försök igen.',
  'update-failed': 'Ändringen kunde inte sparas. Försök igen.',
  unknown: 'Något gick fel. Försök igen.',
}

interface HomeInsuranceEndDateCellProps {
  row: LeaseRentRow
}

/**
 * Shows T.o.m. and, on home insurance rows only and for users with the
 * home-insurance:write role, lets the user change it. The server enforces the
 * same restrictions; this only decides what is shown.
 */
export function HomeInsuranceEndDateCell({
  row,
}: HomeInsuranceEndDateCellProps) {
  const { toast } = useToast()
  const mutation = useSetHomeInsuranceEndDate()
  const [isEditing, setIsEditing] = useState(false)
  const [endDate, setEndDate] = useState(row.to ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const canWrite = useHasRole(HOME_INSURANCE_WRITE_ROLE)

  if (!row.isHomeInsurance || !canWrite) return <span>{row.to ?? '-'}</span>

  if (!isEditing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{row.to ?? '-'}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => {
            setEndDate(row.to ?? '')
            setIsEditing(true)
          }}
          aria-label={`Ändra T.o.m. för ${row.leaseId}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </span>
    )
  }

  const save = () => {
    mutation.mutate(
      { leaseId: row.leaseId, rowId: row.rowId, endDate },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          setIsEditing(false)
          toast({ title: `T.o.m. ändrat till ${endDate} på ${row.leaseId}` })
        },
        onError: (error: unknown) => {
          setConfirmOpen(false)
          const reason =
            error instanceof SetHomeInsuranceEndDateFailed
              ? error.reason
              : 'unknown'
          toast({
            title: 'T.o.m. ändrades inte',
            description: ERROR_TEXT[reason],
            variant: 'destructive',
          })
        },
      }
    )
  }

  const canSave = /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate !== row.to

  return (
    <span className="inline-flex items-center gap-2">
      <Input
        type="date"
        value={endDate}
        min={row.from ?? undefined}
        onChange={(e) => setEndDate(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSave) setConfirmOpen(true)
          if (e.key === 'Escape') setIsEditing(false)
        }}
        className="h-8 w-40"
        aria-label="Nytt T.o.m."
        autoFocus
      />
      <Button
        size="sm"
        className="h-8"
        disabled={!canSave || mutation.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        Spara
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={mutation.isPending}
        onClick={() => setIsEditing(false)}
      >
        Avbryt
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ändra T.o.m. på hemförsäkringen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kontrakt {row.leaseId}: T.o.m. ändras från {row.to ?? 'tomt'} till{' '}
              {endDate}. Ändringen sparas direkt i hyressystemet. Raden ersätts
              av en likadan rad med det nya datumet och får därför ett nytt
              hyresrad-id.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                save()
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Sparar...' : 'Spara ändringen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
