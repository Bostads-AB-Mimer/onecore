import { useMemo, useState } from 'react'
import type { Lease } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useItemSelection } from '@/hooks/useItemSelection'
import { itemTableSelection } from '@/components/shared/tables/itemTableSelection'
import { useRentalObjectKeys } from '@/hooks/useRentalObjectKeys'
import { useLeaseKeyActions } from '@/hooks/useLeaseKeyActions'
import { deriveDisplayStatus } from '@/lib/lease-status'
import { getActiveLoan } from '@/utils/loanHelpers'
import { KeyActionButtons } from './KeyActionButtons'
import { AddKeyButton, AddKeyForm } from './AddKeyForm'
import { ReceiptDialog } from './dialogs/ReceiptDialog'
import { KeyLoanTransferDialog } from './dialogs/KeyLoanTransferDialog'
import { ReturnKeysDialog } from './dialogs/ReturnKeysDialog'
import { LeaseKeysTable } from './LeaseKeysTable'

function getLeaseContactCodes(lease: Lease): string[] {
  return (lease.tenants ?? []).map((t) => t.contactCode).filter(Boolean)
}

export function LeaseKeys({
  lease,
  onKeysLoaned,
  onKeysReturned,
  refreshTrigger,
}: {
  lease: Lease
  onKeysLoaned?: () => void
  onKeysReturned?: () => void
  refreshTrigger?: number
}) {
  const selection = useItemSelection()
  const [showAddKeyForm, setShowAddKeyForm] = useState(false)

  const { keys, cards, loading, refreshStatuses } = useRentalObjectKeys(
    lease.rentalPropertyId,
    refreshTrigger
  )

  const { isProcessing, onRent, onReturn, onDispose, dialogs } =
    useLeaseKeyActions({
      lease,
      keys,
      cards,
      refreshStatuses,
      selection,
      onKeysLoaned,
      onKeysReturned,
    })

  const tenantContactCodes = useMemo(() => getLeaseContactCodes(lease), [lease])
  const leaseIsNotPast = useMemo(
    () => deriveDisplayStatus(lease) !== 'ended',
    [lease]
  )

  // Disposed keys / archived cards are hidden unless still on an active loan.
  const visibleKeys = useMemo(
    () => keys.filter((k) => !k.disposed || !!getActiveLoan(k)),
    [keys]
  )
  const visibleCards = useMemo(
    () =>
      cards.filter((c) => {
        const archived = c.disabled || c.state === 'Archived'
        return !archived || !!getActiveLoan(c)
      }),
    [cards]
  )
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    visibleKeys.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [visibleKeys])

  const t = itemTableSelection(selection, {
    keyIds: visibleKeys.map((k) => k.id),
    cardIds: visibleCards.map((c) => c.cardId),
  })

  const handleKeysAdded = async () => {
    setShowAddKeyForm(false)
    await refreshStatuses()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground">
        <Spinner />
      </div>
    )
  }

  const isEmpty = visibleKeys.length === 0 && visibleCards.length === 0

  return (
    <>
      <div className="space-y-4">
        {isEmpty ? (
          <div className="text-sm text-muted-foreground">
            Inga nycklar eller droppar hittades för detta hyresobjekt.
          </div>
        ) : (
          <>
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(KeyTypeLabels).map(([t, label]) => {
                const n = countsByType.get(t) ?? 0
                if (!n) return null
                return (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {label}: {n}
                  </Badge>
                )
              })}
              {visibleKeys.length > 0 && visibleKeys[0].flexNumber && (
                <Badge variant="outline" className="text-xs">
                  Flex: {visibleKeys[0].flexNumber}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <KeyActionButtons
                selectedKeys={t.selectedKeyIds}
                selectedCards={t.selectedCardIds}
                keysWithStatus={visibleKeys}
                cardsWithStatus={visibleCards}
                leaseIsNotPast={leaseIsNotPast}
                isProcessing={isProcessing}
                onRent={onRent}
                onReturn={onReturn}
                onDispose={onDispose}
                onRefresh={refreshStatuses}
                tenantContactCodes={tenantContactCodes}
              />
              {!showAddKeyForm && (
                <AddKeyButton onClick={() => setShowAddKeyForm(true)} />
              )}
            </div>
          </>
        )}

        {isEmpty && !showAddKeyForm && (
          <AddKeyButton onClick={() => setShowAddKeyForm(true)} />
        )}

        {showAddKeyForm && (
          <AddKeyForm
            keys={keys}
            selectedKeyIds={t.selectedKeyIds}
            rentalObjectCode={lease.rentalPropertyId}
            onComplete={handleKeysAdded}
            onCancel={() => setShowAddKeyForm(false)}
          />
        )}

        {!isEmpty && (
          <LeaseKeysTable
            keys={visibleKeys}
            cards={visibleCards}
            lease={lease}
            selectable={true}
            selection={t}
            onRefresh={refreshStatuses}
            onReturn={onReturn}
          />
        )}
      </div>

      <ReceiptDialog
        isOpen={dialogs.receipt.open}
        onClose={dialogs.receipt.onClose}
        receiptId={dialogs.receipt.receiptId}
      />

      <KeyLoanTransferDialog
        open={dialogs.transfer.open}
        onOpenChange={dialogs.transfer.onOpenChange}
        newKeys={dialogs.transfer.newKeys}
        newCards={dialogs.transfer.newCards}
        existingLoans={dialogs.transfer.existingLoans}
        contact={dialogs.transfer.contact}
        contact2={dialogs.transfer.contact2}
        onSuccess={dialogs.transfer.onSuccess}
      />

      <ReturnKeysDialog
        open={dialogs.return.open}
        onOpenChange={dialogs.return.onOpenChange}
        keyIds={dialogs.return.keyIds}
        cardIds={dialogs.return.cardIds}
        allKeys={keys}
        allCards={cards}
        availability={{ leaseEndDate: dialogs.return.leaseEndDate }}
        onSuccess={dialogs.return.onSuccess}
      />
    </>
  )
}
