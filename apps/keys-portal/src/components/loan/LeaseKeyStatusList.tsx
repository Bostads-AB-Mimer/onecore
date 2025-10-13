import { useEffect, useMemo, useState } from 'react'
import type { Key, Lease, KeyType, ReceiptData } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { keyService } from '@/services/api/keyService'
import { getKeyLoanStatus, type KeyLoanInfo } from '@/utils/keyLoanStatus'
import { useToast } from '@/hooks/use-toast'
import {
  handleLoanKeys,
  handleReturnKeys,
  handleSwitchKeysWithReceipts,
} from '@/services/loanHandlers'
import { KeyActionButtons } from './KeyActionButtons'
import { AddKeyButton, AddKeyForm } from './AddKeyForm'
import { ReceiptDialog } from './ReceiptDialog'

export type KeyWithStatus = Key & {
  loanInfo: KeyLoanInfo
  displayStatus: string
}

const KEY_TYPE_ORDER: Partial<Record<KeyType, number>> = {
  LGH: 1,
  PB: 2,
  FS: 3,
  HN: 4,
}

function isLeaseNotPast(lease: Lease): boolean {
  // If no end date, it's current or future
  if (!lease.leaseEndDate) return true

  // If has end date, check if it's in the future
  const now = new Date()
  const endDate = new Date(lease.leaseEndDate)
  return endDate >= now
}

function getLeaseContactNames(lease: Lease): string[] {
  return (lease.tenants ?? [])
    .map((t) => [t.firstName, t.lastName].filter(Boolean).join(' ').trim())
    .filter(Boolean)
}

export function LeaseKeyStatusList({
  lease,
  onKeysLoaned,
  onKeysSwitched,
  onKeysReturned,
}: {
  lease: Lease
  onKeysLoaned?: () => void
  onKeysSwitched?: () => void
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
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)

  // Add key state
  const [showAddKeyForm, setShowAddKeyForm] = useState(false)

  const tenantNames = useMemo(() => getLeaseContactNames(lease), [lease])
  const leaseIsNotPast = useMemo(() => isLeaseNotPast(lease), [lease])

  // Compute key status - extracted to reuse after loan/return operations
  const computeKeyStatus = async (key: Key): Promise<KeyWithStatus> => {
    try {
      const loanInfo = await getKeyLoanStatus(
        key.id,
        tenantNames[0],
        tenantNames[1]
      )

      let displayStatus = ''

      if (loanInfo.isLoaned) {
        if (loanInfo.contact && tenantNames.includes(loanInfo.contact)) {
          displayStatus = `Utlånat till den här hyresgästen`
        } else {
          displayStatus = `Utlånad till ${loanInfo.contact ?? 'Okänd'}`
        }
      } else {
        if (loanInfo.contact === null) {
          displayStatus = 'Ny'
        } else if (tenantNames.includes(loanInfo.contact)) {
          displayStatus = `Återlämnad av den här hyresgästen`
        } else {
          displayStatus = `Återlämnad av ${loanInfo.contact}`
        }
      }

      return {
        ...key,
        loanInfo,
        displayStatus,
      } as KeyWithStatus
    } catch (error) {
      return {
        ...key,
        loanInfo: { isLoaned: false, contact: null },
        displayStatus: 'Okänd status',
      } as KeyWithStatus
    }
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
  }, [keys, tenantNames])

  const refreshStatuses = async () => {
    const results = await Promise.all(keys.map(computeKeyStatus))
    setKeysWithStatus(results)
  }

  const handleKeyCreated = async (newKey: Key) => {
    setKeys((prev) => [...prev, newKey])
    setShowAddKeyForm(false)
  }

  const onRent = async (keyIds: string[]) => {
    setIsProcessing(true)
    const result = await handleLoanKeys({
      keyIds,
      contact: tenantNames[0],
      contact2: tenantNames[1],
    })

    if (result.success) {
      await refreshStatuses()
      setSelectedKeys([])

      // Open receipt dialog if we have a receiptId
      if (result.receiptId) {
        const relevantKeys = keys.filter((k) => keyIds.includes(k.id))
        setReceiptData({
          lease,
          tenants: lease.tenants ?? [],
          keys: relevantKeys,
          receiptType: 'LOAN',
          operationDate: new Date(),
        })
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
    setIsProcessing(true)
    const result = await handleReturnKeys({ keyIds })

    if (result.success) {
      await refreshStatuses()
      setSelectedKeys([])

      if (result.receiptId) {
        const relevantKeys = keys.filter((k) => keyIds.includes(k.id))
        setReceiptData({
          lease,
          tenants: lease.tenants ?? [],
          keys: relevantKeys,
          receiptType: 'RETURN',
          operationDate: new Date(),
        })
        setReceiptId(result.receiptId)
        setShowReceiptDialog(true)
      } else {
        onKeysReturned?.()
      }
    }

    toast({
      title: result.title,
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })

    setIsProcessing(false)
  }

  const onSwitch = async (keyIds: string[]) => {
    setIsProcessing(true)

    const result = await handleSwitchKeysWithReceipts({
      keyIdsToSwitch: keyIds,
      contact: tenantNames[0],
      contact2: tenantNames[1],
      lease,
      allKeys: keys,
    })

    if (result.success) {
      await refreshStatuses()
      setSelectedKeys([])

      if (result.receiptData && result.receiptId) {
        setReceiptData(result.receiptData)
        setReceiptId(result.receiptId)
        setShowReceiptDialog(true)
      }

      onKeysSwitched?.()
    }

    toast({
      title: result.title,
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })

    setIsProcessing(false)
  }

  const sortedKeys = useMemo(() => {
    const getTypeRank = (t: KeyType) => KEY_TYPE_ORDER[t] ?? 999
    const getSeq = (k: Key) =>
      k.keySequenceNumber == null
        ? Number.POSITIVE_INFINITY
        : Number(k.keySequenceNumber)

    return [...keysWithStatus].sort((a, b) => {
      const typeCmp =
        getTypeRank(a.keyType as KeyType) - getTypeRank(b.keyType as KeyType)
      if (typeCmp !== 0) return typeCmp

      const seqCmp = getSeq(a) - getSeq(b)
      if (seqCmp !== 0) return seqCmp

      return (a.keyName || '').localeCompare(b.keyName || '')
    })
  }, [keysWithStatus])

  // Summary counts by type
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    keysWithStatus.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [keysWithStatus])

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading keys...</div>
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
              <Badge
                variant={
                  sortedKeys[0].flexNumber === 3 ? 'destructive' : 'outline'
                }
                className="text-xs"
              >
                Flex: {sortedKeys[0].flexNumber}
                {sortedKeys[0].flexNumber === 3 && ' (MAX - byt lås)'}
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <KeyActionButtons
              selectedKeys={selectedKeys}
              keysWithStatus={keysWithStatus}
              tenantNames={tenantNames}
              leaseIsNotPast={leaseIsNotPast}
              isProcessing={isProcessing}
              onRent={onRent}
              onReturn={onReturn}
              onSwitch={onSwitch}
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
                key.loanInfo.isLoaned &&
                key.loanInfo.contact &&
                tenantNames.includes(key.loanInfo.contact)
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

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${statusColor}`}>
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
          const wasReturnReceipt = receiptData?.receiptType === 'RETURN'
          setReceiptData(null)
          setReceiptId(null)
          if (wasReturnReceipt) {
            onKeysReturned?.()
          } else {
            onKeysLoaned?.()
          }
        }}
        receiptData={receiptData}
        receiptId={receiptId}
        enableUpload={false}
      />
    </>
  )
}
