import { useEffect, useMemo, useState } from 'react'
import type { Lease, KeyDetails } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ToastAction } from '@/components/ui/toast'
import { keyService } from '@/services/api/keyService'
import { useToast } from '@/hooks/use-toast'
import {
  handleLoanKeys,
  handleDisposeKeys,
  handleUndoDisposeKeys,
} from '@/services/loanHandlers'
import { findExistingActiveLoansForTransfer } from '@/services/loanTransferHelpers'
import type { ExistingLoanInfo } from '@/services/loanTransferHelpers'
import { deriveDisplayStatus } from '@/lib/lease-status'
import { KeyActionButtons } from './KeyActionButtons'
import { AddKeyButton, AddKeyForm } from './AddKeyForm'
import { ReceiptDialog } from './dialogs/ReceiptDialog'
import { KeyLoanTransferDialog } from './dialogs/KeyLoanTransferDialog'
import { ReturnKeysDialog } from './dialogs/ReturnKeysDialog'
import { LeaseKeyTableList } from './LeaseKeyTableList'

function getLeaseContactCodes(lease: Lease): string[] {
  return (lease.tenants ?? []).map((t) => t.contactCode).filter(Boolean)
}

export function LeaseKeyStatusList({
  lease,
  keysData,
  onKeysLoaned,
  onKeysReturned,
  onKeyCreated,
  refreshTrigger,
}: {
  lease: Lease
  keysData?: KeyDetails[]
  onKeysLoaned?: () => void
  onKeysReturned?: () => void
  onKeyCreated?: () => void
  refreshTrigger?: number
}) {
  const { toast } = useToast()
  const [keys, setKeys] = useState<KeyDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // Receipt dialog state
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [receiptId, setReceiptId] = useState<string | null>(null)

  // Transfer dialog state
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [pendingLoanKeyIds, setPendingLoanKeyIds] = useState<string[]>([])
  const [existingLoansForTransfer, setExistingLoansForTransfer] = useState<
    ExistingLoanInfo[]
  >([])

  // Return dialog state
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [pendingReturnKeyIds, setPendingReturnKeyIds] = useState<string[]>([])

  // Add key state
  const [showAddKeyForm, setShowAddKeyForm] = useState(false)

  const tenantContactCodes = useMemo(() => getLeaseContactCodes(lease), [lease])
  const leaseIsNotPast = useMemo(
    () => deriveDisplayStatus(lease) !== 'ended',
    [lease]
  )

  // Initial fetch - only if keysData is NOT provided as prop
  useEffect(() => {
    // If parent provides keysData, skip fetching
    if (keysData) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const fetchedKeys = await keyService.getKeysWithLoanAndEvent(
          lease.rentalPropertyId,
          true, // Include latest event to avoid N+1 queries
          true // Include key system to avoid N+1 queries
        )
        if (!cancelled) {
          setKeys(fetchedKeys)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId, keysData])

  // Handle keysData prop changes - no fetching, just update state
  useEffect(() => {
    if (keysData) {
      setKeys(keysData)
      setLoading(false)
    }
  }, [keysData])

  // Refresh when external trigger changes (e.g., after receipt upload)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refreshStatuses()
    }
  }, [refreshTrigger])

  const refreshStatuses = async () => {
    // If parent provides keysData, delegate refresh to parent
    if (keysData && onKeyCreated) {
      onKeyCreated()
      return
    }

    // Only fetch directly if component is standalone (no parent providing data)
    const fetchedKeys = await keyService.getKeysWithLoanAndEvent(
      lease.rentalPropertyId,
      true,
      true
    )
    setKeys(fetchedKeys)
  }

  const handleKeyCreated = async () => {
    setShowAddKeyForm(false)
    // Notify parent component to refetch its keys data
    // Parent will refetch and pass updated keysData down, triggering our useEffect
    onKeyCreated?.()
  }

  const onRent = async (keyIds: string[]) => {
    // Check if there are existing active loans for these contacts on this object
    const existingLoans = await findExistingActiveLoansForTransfer(
      tenantContactCodes,
      lease.rentalPropertyId
    )

    if (existingLoans.length > 0) {
      // Show transfer dialog
      setPendingLoanKeyIds(keyIds)
      setExistingLoansForTransfer(existingLoans)
      setShowTransferDialog(true)
      return
    }

    // No existing loans - proceed normally
    setIsProcessing(true)
    const result = await handleLoanKeys({
      keyIds,
      contact: tenantContactCodes[0],
      contact2: tenantContactCodes[1],
    })

    if (result.success) {
      await refreshStatuses()
      setSelectedKeys([])

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

  const onReturn = async (keyIds: string[]) => {
    // Show the return dialog
    setPendingReturnKeyIds(keyIds)
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
      return !!key.loan
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
      <Card className="mt-2">
        <CardContent className="p-3 space-y-3">
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
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-2">
        <CardContent className="space-y-4 p-3">
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
            <KeyActionButtons
              selectedKeys={selectedKeys}
              keysWithStatus={visibleKeys}
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

          {/* Keys table */}
          <LeaseKeyTableList
            keys={visibleKeys}
            tenantContactCodes={tenantContactCodes}
            selectable={true}
            selectedKeys={selectedKeys}
            onKeySelectionChange={(keyId, checked) => {
              setSelectedKeys((prev) =>
                checked ? [...prev, keyId] : prev.filter((id) => id !== keyId)
              )
            }}
          />
        </CardContent>
      </Card>

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
        existingLoans={existingLoansForTransfer}
        contact={tenantContactCodes[0]}
        contact2={tenantContactCodes[1]}
        onSuccess={async (receiptId) => {
          // Refresh and show receipt
          await refreshStatuses()
          setSelectedKeys([])

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
        allKeys={keys}
        lease={lease}
        onSuccess={async () => {
          // Refresh statuses and clear selection
          await refreshStatuses()
          setSelectedKeys([])
          onKeysReturned?.()
        }}
      />
    </>
  )
}
