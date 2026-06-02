import { useEffect, useState } from 'react'
import type { KeyDetails, CardDetails } from '@/services/types'
import { ReturnKeysDialogBase } from '@/components/shared/dialogs/ReturnKeysDialogBase'
import { CommentInput } from '@/components/shared/CommentInput'
import { AvailabilityDatePicker } from '@/components/shared/AvailabilityDatePicker'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'
import { useReturnKeys } from '@/hooks/useReturnKeys'

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

  const opts = () => ({
    availableToNextTenantFrom: availability
      ? availableDate?.toISOString()
      : undefined,
    comment: addSignature(comment),
  })

  const rightContent = (
    <div className="space-y-4">
      {availability && (
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

  return (
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
        r.partialMode ? r.partialAccept(opts()) : r.accept(opts())
      }
      acceptButtonText={label}
      primaryLabel={label}
      totalCount={r.partialMode ? r.selectedCount : r.totalCount}
      secondaryAction={
        r.partialMode
          ? {
              label: 'Retur med saknade nycklar',
              onClick: () => r.accept(opts()),
              variant: 'secondary',
            }
          : undefined
      }
      title="Återlämna nycklar och droppar"
      description="Välj vilka nycklar och droppar som ska visas på kvittensen."
    />
  )
}
