import { useEffect, useMemo, useState } from 'react'
import type { Key, Lease, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { keyService } from '@/services/api/keyService'
import { getKeyLoanStatus } from '@/utils/keyLoanStatus'
import {
  sortKeysByTypeAndSequence,
  computeKeyWithStatus,
  filterVisibleKeys,
  type KeyWithStatus,
} from '@/utils/keyStatusHelpers'
import { useToast } from '@/hooks/use-toast'
import { handleLoanKeys, handleDisposeKeys } from '@/services/loanHandlers'
import { findExistingActiveLoansForTransfer } from '@/services/loanTransferHelpers'
import type { ExistingLoanInfo } from '@/services/loanTransferHelpers'
import { KeyActionButtons } from './KeyActionButtons'
import { AddKeyButton, AddKeyForm } from './AddKeyForm'
import { ReceiptDialog } from './ReceiptDialog'
import { KeyLoanTransferDialog } from './KeyLoanTransferDialog'
import { ReturnKeysDialog } from './ReturnKeysDialog'

function isLeaseNotPast(lease: Lease): boolean {
  // If no end date, it's current or future
  if (!lease.leaseEndDate) return true

  // If has end date, check if it's in the future
  const now = new Date()
  const endDate = new Date(lease.leaseEndDate)
  return endDate >= now
}

function getLeaseContactCodes(lease: Lease): string[] {
  return (lease.tenants ?? []).map((t) => t.contactCode).filter(Boolean)
}

export function LeaseKeyStatusList({
  lease,
  onKeysLoaned,
  onKeysReturned,
}: {
  lease: Lease
  onKeysLoaned?: () => void
  onKeysReturned?: () => void
}) {
  const { toast } = useToast()
  const [keys, setKeys] = useState<Key[]>([])
  const [keysWithStatus, setKeysWithStatus] = useState<KeyWithStatus[]>([])
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
  const leaseIsNotPast = useMemo(() => isLeaseNotPast(lease), [lease])

  // Compute key status - extracted to reuse after loan/return operations
  const computeKeyStatus = (key: Key): Promise<KeyWithStatus> => {
    return computeKeyWithStatus(key, keys, tenantContactCodes, getKeyLoanStatus)
  }

  // Fetch keys for the rental object
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await keyService.searchKeys({
          rentalObjectCode: lease.rentalPropertyId,
        })
        if (!cancelled) setKeys(list.content)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId])

  useEffect(() => {
    if (keys.length === 0) {
      setKeysWithStatus([])
      return
    }

    let cancelled = false
    ;(async () => {
      const results = await Promise.all(keys.map(computeKeyStatus))
      if (!cancelled) setKeysWithStatus(results)
    })()

    return () => {
      cancelled = true
    }
  }, [keys, tenantContactCodes])

  const refreshStatuses = async () => {
    // Refetch keys from backend to get updated key properties (e.g., disposed status)
    const list = await keyService.searchKeys({
      rentalObjectCode: lease.rentalPropertyId,
    })
    setKeys(list.content)
    // The useEffect will automatically recompute statuses when keys changes
  }

  const handleKeyCreated = async (newKey: Key) => {
    setKeys((prev) => [...prev, newKey])
    setShowAddKeyForm(false)
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
    }

    toast({
      title: result.title,
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })

    setIsProcessing(false)
  }

  // Filter out disposed keys that don't have active loans
  const visibleKeys = useMemo(
    () => filterVisibleKeys(keysWithStatus),
    [keysWithStatus]
  )

  const sortedKeys = useMemo(
    () => sortKeysByTypeAndSequence(visibleKeys),
    [visibleKeys]
  )

  // Summary counts by type (only visible keys)
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    visibleKeys.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [visibleKeys])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading keys...</div>
  }

  if (sortedKeys.length === 0) {
    return (
      <Card className="mt-2">
        <CardContent className="p-3">
          <div className="text-sm text-muted-foreground">
            No keys found for this rental object.
          </div>
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
            {sortedKeys.length > 0 && sortedKeys[0].flexNumber && (
              <Badge variant="outline" className="text-xs">
                Flex: {sortedKeys[0].flexNumber}
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <KeyActionButtons
              selectedKeys={selectedKeys}
              keysWithStatus={keysWithStatus}
              leaseIsNotPast={leaseIsNotPast}
              isProcessing={isProcessing}
              onRent={onRent}
              onReturn={onReturn}
              onDispose={onDispose}
              onRefresh={async () => {
                // Refresh keys and statuses after flex keys are created
                const list = await keyService.searchKeys({
                  rentalObjectCode: lease.rentalPropertyId,
                })
                setKeys(list.content)
              }}
            />
            {!showAddKeyForm && (
              <AddKeyButton onClick={() => setShowAddKeyForm(true)} />
            )}
          </div>

          {/* Add key form */}
          {showAddKeyForm && (
            <AddKeyForm
              keys={keys}
              rentalObjectCode={lease.rentalPropertyId}
              onKeyCreated={handleKeyCreated}
              onCancel={() => setShowAddKeyForm(false)}
            />
          )}

          {/* Keys list */}
          <div className="space-y-1">
            {sortedKeys.map((key, index) => {
              const canRent = !key.loanInfo.isLoaned && leaseIsNotPast
              const canReturn =
                key.loanInfo.isLoaned && key.loanInfo.matchesCurrentTenant
              const isSelectable = canRent || canReturn

              const statusColor = key.loanInfo.isLoaned
                ? 'text-destructive'
                : canRent
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground'

              return (
                <div
                  key={key.id}
                  className={`flex items-center justify-between py-2 px-1 ${
                    index > 0 ? 'border-t border-border/50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {isSelectable && (
                      <Checkbox
                        checked={selectedKeys.includes(key.id)}
                        onCheckedChange={(checked) => {
                          setSelectedKeys((prev) =>
                            checked
                              ? [...prev, key.id]
                              : prev.filter((id) => id !== key.id)
                          )
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">
                          {key.keyName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {KeyTypeLabels[key.keyType as KeyType]}
                        </span>
                        {key.keySequenceNumber && (
                          <span className="text-xs text-muted-foreground">
                            Löp: {key.keySequenceNumber}
                          </span>
                        )}
                        {key.flexNumber && (
                          <span className="text-xs text-muted-foreground">
                            Flex: {key.flexNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm">
                    {key.displayDate && (
                      <span className="text-muted-foreground whitespace-nowrap">
                        {key.displayDate}
                      </span>
                    )}
                    <span
                      className={`font-medium whitespace-nowrap ${statusColor}`}
                    >
                      {key.displayStatus}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
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
