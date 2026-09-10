import { useEffect, useState } from 'react'
import type { KeyDetails, CardDetails } from '@/services/types'
import { ReturnKeysDialogBase } from '@/components/shared/dialogs/ReturnKeysDialogBase'
import { CommentInput } from '@/components/shared/CommentInput'
import { AvailabilityDatePicker } from '@/components/shared/AvailabilityDatePicker'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'
import { useReturnKeys } from '@/hooks/useReturnKeys'
import { ConfirmDialog } from '@/components/shared/dialogs/ConfirmDialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyIds: string[]
  cardIds?: string[]
  allKeys: KeyDetails[]
  allCards?: CardDetails[]
  /**
   * Tenant returns pass this to collect an "available to next tenant from" date
   * (defaulted to the lease end). Omit for maintenance returns — their keys go back
   * to a pool, so there is no next tenant.
   */
  availability?: { leaseEndDate?: string }
  onSuccess: () => void
}

/**
 * The one return dialog for tenant and maintenance. The shared brain lives in
 * `useReturnKeys`; the only fork is the optional availability date (tenant only).
 */
export function ReturnKeysDialog({
  open,
  onOpenChange,
  keyIds,
  cardIds = [],
  allKeys,
  allCards = [],
  availability,
  onSuccess,
}: Props) {
  const { addSignature } = useCommentWithSignature()
  const [availableDate, setAvailableDate] = useState<Date | undefined>(
    undefined
  )
  const [comment, setComment] = useState('')
  const [confirmAllMissing, setConfirmAllMissing] = useState(false)

  const leaseEndDate = availability?.leaseEndDate
  useEffect(() => {
    setAvailableDate(leaseEndDate ? new Date(leaseEndDate) : undefined)
  }, [leaseEndDate])

  const r = useReturnKeys({
    open,
    keyIds,
    cardIds,
    allKeys,
    allCards,
    onClose: () => onOpenChange(false),
    onSuccess,
  })

  // The availability date is tenant-only: offered when the call site allows it AND the
  // resolved loan is a tenant loan (so a maintenance loan on the tenant page won't show it).
  const showAvailability = !!availability && r.includesTenantLoan

  const opts = () => ({
    availableToNextTenantFrom: showAvailability
      ? availableDate?.toISOString()
      : undefined,
    comment: addSignature(comment),
  })

  const rightContent = (
    <div className="space-y-4">
      {showAvailability && (
        <AvailabilityDatePicker
          availableDate={availableDate}
          onDateChange={setAvailableDate}
        />
      )}
      <CommentInput
        value={comment}
        onChange={setComment}
        placeholder="Lägg till en kommentar på kvittensen..."
      />
    </div>
  )

  const label = r.partialMode ? 'Partiell retur' : 'Återlämna'

  // A full return where a loan has nothing checked closes it with every key marked
  // missing/lost — legitimate, but confirm it first so it's never a silent surprise.
  const requestAccept = () => {
    if (r.loansClosingAllMissing.length > 0) setConfirmAllMissing(true)
    else r.accept(opts())
  }

  const missingNames = r.loansClosingAllMissing.flatMap((g) => [
    ...g.keys.filter((k) => !k.disposed).map((k) => k.keyName),
    ...g.cards.map((c) => c.name || c.cardId),
  ])

  return (
    <>
      <ReturnKeysDialogBase
        open={open}
        onOpenChange={onOpenChange}
        loanGroups={r.loanGroups}
        loading={r.loading}
        selectedKeyIds={r.selectedKeyIds}
        selectedCardIds={r.selectedCardIds}
        onToggleKey={r.toggleKey}
        onToggleCard={r.toggleCard}
        rightContent={rightContent}
        isProcessing={r.isProcessing}
        onAccept={() =>
          r.partialMode ? r.partialAccept(opts()) : requestAccept()
        }
        acceptButtonText={label}
        primaryLabel={label}
        totalCount={r.partialMode ? r.selectedCount : r.totalCount}
        secondaryAction={
          r.partialMode
            ? {
                label: 'Retur med saknade nycklar',
                onClick: requestAccept,
                variant: 'secondary',
              }
            : undefined
        }
        title="Återlämna nycklar och droppar"
        description="Välj vilka nycklar och droppar som ska visas på kvittensen."
      />

      <ConfirmDialog
        open={confirmAllMissing}
        onOpenChange={(o) => {
          if (!o) setConfirmAllMissing(false)
        }}
        title="Återlämna med alla nycklar saknade?"
        description={
          <p>
            Inget är ikryssat för{' '}
            {r.loansClosingAllMissing.length === 1 ? 'ett lån' : 'vissa lån'} —
            följande återlämnas med <strong>alla markerade som saknade</strong>:
            <br />
            <br />
            {missingNames.join(', ')}
          </p>
        }
        confirmLabel="Återlämna ändå"
        onConfirm={() => {
          setConfirmAllMissing(false)
          r.accept(opts())
        }}
      />
    </>
  )
}
