import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Key, Lease, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ToastAction } from '@/components/ui/toast'
import { keyService } from '@/services/api/keyService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { getKeyLoanStatus } from '@/utils/keyLoanStatus'
import {
  sortKeysByTypeAndSequence,
  computeKeyWithStatus,
  filterVisibleKeys,
  type KeyWithStatus,
} from '@/utils/keyStatusHelpers'
import { useToast } from '@/hooks/use-toast'
import {
  handleLoanKeys,
  handleDisposeKeys,
  handleUndoDisposeKeys,
} from '@/services/loanHandlers'
import { findExistingActiveLoansForTransfer } from '@/services/loanTransferHelpers'
import type { ExistingLoanInfo } from '@/services/loanTransferHelpers'
import { KeyActionButtons } from './KeyActionButtons'
import { AddKeyButton, AddKeyForm } from './AddKeyForm'
import { ReceiptDialog } from './ReceiptDialog'
import { KeyLoanTransferDialog } from './KeyLoanTransferDialog'
import { ReturnKeysDialog } from './ReturnKeysDialog'
import { Pencil } from 'lucide-react'

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

// Component for editing the available date inline
function EditableAvailableDate({
  keyId,
  currentDate,
  onUpdate,
}: {
  keyId: string
  currentDate?: string
  onUpdate: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  )
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      // Get the loan for this key
      const loans = await keyLoanService.getByKeyId(keyId)
      const returnedLoan = loans.find((loan) => loan.returnedAt)

      if (!returnedLoan) {
        toast({
          title: 'Fel',
          description: 'Kunde inte hitta återlämnad nyckel',
          variant: 'destructive',
        })
        return
      }

      // Update the loan with the new available date
      await keyLoanService.update(returnedLoan.id, {
        availableToNextTenantFrom: selectedDate?.toISOString(),
      })

      toast({
        title: 'Uppdaterat',
        description: 'Tillgänglighetsdatum har uppdaterats',
      })

      setOpen(false)
      onUpdate()
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte uppdatera datum',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 hover:bg-muted"
          title="Ändra tillgänglighetsdatum"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-3 space-y-3">
          <div className="text-sm font-medium">Ändra tillgänglighetsdatum</div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isUpdating}
            >
              Avbryt
            </Button>
            <Button size="sm" onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? 'Uppdaterar...' : 'Spara'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
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
  const navigate = useNavigate()
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

  // Refresh when external trigger changes (e.g., after receipt upload)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refreshStatuses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

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

  const handleEditKey = (keyId: string) => {
    navigate(
      `/Keys?rentalObjectCode=${lease.rentalPropertyId}&disposed=false&editKeyId=${keyId}`
    )
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
              selectedKeyIds={selectedKeys}
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

              // Use isAvailable flag for color: green if available, red if blocked, muted otherwise
              const statusColor = key.isAvailable
                ? 'text-green-600 dark:text-green-400'
                : key.loanInfo.isLoaned
                  ? 'text-destructive'
                  : 'text-muted-foreground'

              // Check if this key has an available date that can be edited
              const hasAvailableDate =
                !key.loanInfo.isLoaned &&
                key.loanInfo.availableToNextTenantFrom !== undefined

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
                        <button
                          onClick={() => handleEditKey(key.id)}
                          className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {key.keyName}
                        </button>
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

                  {/* Right side: status first, then date with a subtle separator */}
                  <div className="flex items-center justify-end gap-3 text-sm">
                    <span
                      className={`font-medium whitespace-nowrap ${statusColor}`}
                    >
                      {key.displayStatus}
                    </span>

                    {key.displayDate && (
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="opacity-30 select-none">
                          •
                        </span>
                        <span className="text-muted-foreground tabular-nums sm:whitespace-nowrap">
                          {key.displayDate}
                        </span>

                        {hasAvailableDate && (
                          <div className="ml-1">
                            <EditableAvailableDate
                              keyId={key.id}
                              currentDate={
                                key.loanInfo.availableToNextTenantFrom
                              }
                              onUpdate={refreshStatuses}
                            />
                          </div>
                        )}
                      </div>
                    )}
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
