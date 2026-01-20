import { useEffect, useMemo, useState } from 'react'
import type { Lease, KeyDetails, CardDetails } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToastAction } from '@/components/ui/toast'
import { keyService } from '@/services/api/keyService'
import { cardService } from '@/services/api/cardService'
import { useToast } from '@/hooks/use-toast'
import {
  handleLoanKeys,
  handleDisposeKeys,
  handleUndoDisposeKeys,
} from '@/services/loanHandlers'
import { findExistingActiveLoansForTransfer } from '@/services/loanTransferHelpers'
import type { ExistingLoanInfo } from '@/services/loanTransferHelpers'
import { deriveDisplayStatus } from '@/lib/lease-status'
import { getActiveLoan } from '@/utils/loanHelpers'
import { KeyActionButtons } from './KeyActionButtons'
import { AddKeyButton, AddKeyForm } from './AddKeyForm'
import { ReceiptDialog } from './dialogs/ReceiptDialog'
import { KeyLoanTransferDialog } from './dialogs/KeyLoanTransferDialog'
import { ReturnKeysDialog } from './dialogs/ReturnKeysDialog'
import { LeaseItemsList } from './LeaseItemsList'

function getLeaseContactCodes(lease: Lease): string[] {
  return (lease.tenants ?? []).map((t) => t.contactCode).filter(Boolean)
}

export function LeaseKeyStatusList({
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
  const { toast } = useToast()
  const [keys, setKeys] = useState<KeyDetails[]>([])
  const [cards, setCards] = useState<CardDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [selectedCards, setSelectedCards] = useState<string[]>([])

  // Receipt dialog state
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [receiptId, setReceiptId] = useState<string | null>(null)

  // Transfer dialog state
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [pendingLoanKeyIds, setPendingLoanKeyIds] = useState<string[]>([])
  const [pendingLoanCardIds, setPendingLoanCardIds] = useState<string[]>([])
  const [existingLoansForTransfer, setExistingLoansForTransfer] = useState<
    ExistingLoanInfo[]
  >([])

  // Return dialog state
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [pendingReturnKeyIds, setPendingReturnKeyIds] = useState<string[]>([])
  const [pendingReturnCardIds, setPendingReturnCardIds] = useState<string[]>([])

  // Add key state
  const [showAddKeyForm, setShowAddKeyForm] = useState(false)

  const tenantContactCodes = useMemo(() => getLeaseContactCodes(lease), [lease])
  const leaseIsNotPast = useMemo(
    () => deriveDisplayStatus(lease) !== 'ended',
    [lease]
  )

  // Fetch keys and cards on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [fetchedKeys, fetchedCards] = await Promise.all([
          keyService.getKeysByRentalObjectCode(lease.rentalPropertyId, {
            includeLoans: true,
            includeEvents: true,
            includeKeySystem: true,
          }),
          cardService.getCardsByRentalObjectCode(lease.rentalPropertyId, {
            includeLoans: true,
          }),
        ])
        if (!cancelled) {
          setKeys(fetchedKeys)
          setCards(fetchedCards)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId])

  // Refresh when external trigger changes (e.g., after receipt upload)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refreshStatuses()
    }
  }, [refreshTrigger])

  const refreshStatuses = async () => {
    const [fetchedKeys, fetchedCards] = await Promise.all([
      keyService.getKeysByRentalObjectCode(lease.rentalPropertyId, {
        includeLoans: true,
        includeEvents: true,
        includeKeySystem: true,
      }),
      cardService.getCardsByRentalObjectCode(lease.rentalPropertyId, {
        includeLoans: true,
      }),
    ])
    setKeys(fetchedKeys)
    setCards(fetchedCards)
  }

  const handleKeyCreated = async () => {
    setShowAddKeyForm(false)
    // Refresh keys after a new key is created
    await refreshStatuses()
  }

  const onRent = async (keyIds: string[], cardIds: string[]) => {
    // Check if there are existing active loans for these contacts on this object
    const existingLoans = await findExistingActiveLoansForTransfer(
      tenantContactCodes,
      lease.rentalPropertyId
    )

    if (existingLoans.length > 0) {
      // Show transfer dialog
      setPendingLoanKeyIds(keyIds)
      setPendingLoanCardIds(cardIds)
      setExistingLoansForTransfer(existingLoans)
      setShowTransferDialog(true)
      return
    }

    // No existing loans - proceed normally
    setIsProcessing(true)
    const result = await handleLoanKeys({
      keyIds,
      cardIds,
      contact: tenantContactCodes[0],
      contact2: tenantContactCodes[1],
    })

    if (result.success) {
      await refreshStatuses()
      setSelectedKeys([])
      setSelectedCards([])

      // Open receipt dialog if we have a receiptId
      if (result.receiptId) {
        setReceiptId(result.receiptId)
        setShowReceiptDialog(true)
      } else {
        onKeysLoaned?.()
      }
    }

    toast({
      title: result.title,
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })

    setIsProcessing(false)
  }

  const onReturn = async (keyIds: string[], cardIds: string[]) => {
    // Show the return dialog
    setPendingReturnKeyIds(keyIds)
    setPendingReturnCardIds(cardIds)
    setShowReturnDialog(true)
  }

  const onDispose = async (keyIds: string[]) => {
    setIsProcessing(true)

    const result = await handleDisposeKeys({ keyIds })

    if (result.success) {
      await refreshStatuses()
      setSelectedKeys([])

      // Show toast with undo action - custom styling for prominence
      toast({
        title: result.title,
        description: result.message,
        duration: 10000, // 10 seconds
        variant: 'destructive', // Make it stand out more
        className: '!w-full !p-4 !shadow-xl',
        action: (
          <ToastAction
            altText="Ångra kasseringen"
            className="!px-3 !text-sm !font-semibold !opacity-100"
            onClick={async () => {
              // Undo the disposal
              const undoResult = await handleUndoDisposeKeys({ keyIds })
              await refreshStatuses()

              // Show undo confirmation toast and manually dismiss after 3 seconds
              const undoToast = toast({
                title: undoResult.title,
                description: undoResult.message,
              })

              setTimeout(() => {
                undoToast.dismiss()
              }, 3000)
            }}
          >
            Ångra
          </ToastAction>
        ),
      })
    } else {
      // Show error toast without undo action
      toast({
        title: result.title,
        description: result.message,
        variant: 'destructive',
      })
    }

    setIsProcessing(false)
  }

  // Filter out disposed keys (unless they have active loans)
  const visibleKeys = useMemo(() => {
    return keys.filter((key) => {
      if (!key.disposed) return true
      // Include disposed key only if it's currently loaned
      return !!getActiveLoan(key)
    })
  }, [keys])

  // Summary counts by type (only visible keys)
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    visibleKeys.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [visibleKeys])

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">Laddar nycklar...</div>
    )
  }

  if (visibleKeys.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Inga nycklar hittades för detta hyresobjekt.
        </div>
        <div className="flex gap-2">
          {!showAddKeyForm && (
            <AddKeyButton onClick={() => setShowAddKeyForm(true)} />
          )}
        </div>
        {showAddKeyForm && (
          <AddKeyForm
            keys={keys}
            selectedKeyIds={selectedKeys}
            rentalObjectCode={lease.rentalPropertyId}
            onKeyCreated={handleKeyCreated}
            onCancel={() => setShowAddKeyForm(false)}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
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

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Select all / Deselect all button */}
          {visibleKeys.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedKeys.length === visibleKeys.length) {
                  setSelectedKeys([])
                } else {
                  setSelectedKeys(visibleKeys.map((k) => k.id))
                }
              }}
              disabled={isProcessing}
            >
              {selectedKeys.length === visibleKeys.length
                ? 'Avmarkera alla'
                : 'Markera alla'}
            </Button>
          )}
          <KeyActionButtons
            selectedKeys={selectedKeys}
            selectedCards={selectedCards}
            keysWithStatus={visibleKeys}
            cardsWithStatus={cards}
            leaseIsNotPast={leaseIsNotPast}
            isProcessing={isProcessing}
            onRent={onRent}
            onReturn={onReturn}
            onDispose={onDispose}
            onRefresh={async () => {
              // Refresh keys and statuses after flex keys are created
              await refreshStatuses()
            }}
            tenantContactCodes={tenantContactCodes}
          />
          {!showAddKeyForm && (
            <AddKeyButton onClick={() => setShowAddKeyForm(true)} />
          )}
        </div>

        {/* Add key form */}
        {showAddKeyForm && (
          <AddKeyForm
            keys={keys}
            selectedKeyIds={selectedKeys}
            rentalObjectCode={lease.rentalPropertyId}
            onKeyCreated={handleKeyCreated}
            onCancel={() => setShowAddKeyForm(false)}
          />
        )}

        {/* Keys and cards table */}
        <LeaseItemsList
          keys={visibleKeys}
          cards={cards}
          selectable={true}
          selectedKeys={selectedKeys}
          selectedCards={selectedCards}
          onKeySelectionChange={(keyId, checked) => {
            setSelectedKeys((prev) =>
              checked ? [...prev, keyId] : prev.filter((id) => id !== keyId)
            )
          }}
          onCardSelectionChange={(cardId, checked) => {
            setSelectedCards((prev) =>
              checked ? [...prev, cardId] : prev.filter((id) => id !== cardId)
            )
          }}
        />
      </div>

      <ReceiptDialog
        isOpen={showReceiptDialog}
        onClose={() => {
          setShowReceiptDialog(false)
          setReceiptId(null)
          // Always call onKeysLoaned when receipt dialog closes
          // (works for both loan and return receipts in this context)
          onKeysLoaned?.()
        }}
        receiptId={receiptId}
        lease={lease}
      />

      <KeyLoanTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        newKeys={keys.filter((k) => pendingLoanKeyIds.includes(k.id))}
        newCards={cards.filter((c) => pendingLoanCardIds.includes(c.cardId))}
        existingLoans={existingLoansForTransfer}
        contact={tenantContactCodes[0]}
        contact2={tenantContactCodes[1]}
        onSuccess={async (receiptId) => {
          // Refresh and show receipt
          await refreshStatuses()
          setSelectedKeys([])
          setSelectedCards([])

          if (receiptId) {
            setReceiptId(receiptId)
            setShowReceiptDialog(true)
          } else {
            onKeysLoaned?.()
          }
        }}
      />

      <ReturnKeysDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        keyIds={pendingReturnKeyIds}
        cardIds={pendingReturnCardIds}
        allKeys={keys}
        allCards={cards}
        lease={lease}
        onSuccess={async () => {
          // Refresh statuses and clear selection
          await refreshStatuses()
          setSelectedKeys([])
          setSelectedCards([])
          onKeysReturned?.()
        }}
      />
    </>
  )
}
