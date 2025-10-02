// components/loan/EmbeddedKeysList.tsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import type {
  Key,
  Lease,
  KeyType,
  ReceiptData,
  KeyLoan,
} from '@/services/types'
import { KeyTypeLabels, toReceiptTenant } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus } from 'lucide-react'
import { ReceiptDialog } from './ReceiptDialog'
import { ReceiptHistory } from './ReceiptHistory'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'

type LoanStatus = 'never_loaned' | 'loaned' | 'returned'

export function EmbeddedKeysList({
  lease,
  initialKeys = [],
}: {
  lease: Lease
  initialKeys?: Key[]
}) {
  // ------- State -------
  const [keys, setKeys] = useState<Key[]>(initialKeys)
  const [loadingKeys, setLoadingKeys] = useState(false)

  // use the server type directly; no local redefinition needed
  const [loans, setLoans] = useState<KeyLoan[]>([])
  const [loadingLoans, setLoadingLoans] = useState(false)

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [lastTransactionKeyLoanIds, setLastTransactionKeyLoanIds] = useState<
    string[]
  >([])

  // Keep local keys in sync if parent re-renders with fresh ones
  useEffect(() => {
    setKeys(initialKeys)
  }, [initialKeys])

  // If parent didn't pass keys, fetch by rentalObjectCode
  useEffect(() => {
    if (initialKeys.length > 0) return
    let cancelled = false
    ;(async () => {
      setLoadingKeys(true)
      try {
        const list = await keyService.searchKeys({
          rentalObjectCode: lease.rentalPropertyId,
        })
        if (!cancelled) setKeys(list)
      } finally {
        if (!cancelled) setLoadingKeys(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId, initialKeys.length])

  // Load loans for this lease
  const refreshLoans = useCallback(async () => {
    setLoadingLoans(true)
    try {
      const list = await keyLoanService.search({ lease: lease.leaseId })
      setLoans(list)
    } finally {
      setLoadingLoans(false)
    }
  }, [lease.leaseId])

  useEffect(() => {
    refreshLoans()
  }, [refreshLoans])

  // --- Helpers ---
  const activeLoanByKeyId = useMemo(() => {
    const m = new Map<string, KeyLoan>()
    for (const l of loans) {
      if (!l.returnedAt) {
        try {
          const keyIds = JSON.parse(l.keys ?? '[]') as string[]
          keyIds.forEach((id) => m.set(id, l))
        } catch {
          /* ignore */
        }
      }
    }
    return m
  }, [loans])

  const getStatus = (keyId: string): LoanStatus => {
    if (activeLoanByKeyId.has(keyId)) return 'loaned'
    const ever = loans.some((l) => {
      try {
        const ids = JSON.parse(l.keys ?? '[]') as string[]
        return ids.includes(keyId)
      } catch {
        return false
      }
    })
    return ever ? 'returned' : 'never_loaned'
  }

  const availableKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) !== 'loaned'),
    [keys, activeLoanByKeyId, loans]
  )
  const loanedKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) === 'loaned'),
    [keys, activeLoanByKeyId]
  )

  const toggleSelection = (keyId: string, checked: boolean) => {
    setSelectedKeys((prev) =>
      checked ? [...prev, keyId] : prev.filter((id) => id !== keyId)
    )
  }

  // ---- Receipt helpers ----
  const openReceiptDialog = (
    type: 'loan' | 'return',
    keyIds: string[],
    keyLoanIds: string[],
    when?: string
  ) => {
    const t = lease.tenants?.[0]
    const tenant = t
      ? toReceiptTenant(t)
      : { id: '', personnummer: '', firstName: 'Okänd', lastName: 'Hyresgäst' }
    const relevantKeys = keys.filter((k) => keyIds.includes(k.id))

    setReceiptData({
      lease,
      tenant,
      keys: relevantKeys,
      receiptType: type,
      operationDate: when ? new Date(when) : new Date(),
    })
    setLastTransactionKeyLoanIds(keyLoanIds)
    setShowReceiptDialog(true)
  }

  // ---- Actions: Loan / Return ----
  const handleLoanSelected = async () => {
    if (selectedKeys.length === 0) return
    setIsProcessing(true)
    try {
      const t = lease.tenants?.[0]
      const contact = t
        ? `contact-${(t.firstName ?? '').toLowerCase()}-${(t.lastName ?? '').toLowerCase()}`
        : undefined

      const createdIds: string[] = []
      for (const keyId of selectedKeys) {
        const created = await keyLoanService.create({
          keys: JSON.stringify([keyId]),
          lease: lease.leaseId,
          contact,
          pickedUpAt: new Date().toISOString(),
          createdBy: 'ui',
        })
        if (created.id) createdIds.push(created.id)
      }

      await refreshLoans()
      openReceiptDialog('loan', selectedKeys, createdIds)
      setSelectedKeys([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLoanAll = async () => {
    const ids = availableKeys.map((k) => k.id)
    if (ids.length === 0) return
    setIsProcessing(true)
    try {
      const t = lease.tenants?.[0]
      const contact = t
        ? `contact-${(t.firstName ?? '').toLowerCase()}-${(t.lastName ?? '').toLowerCase()}`
        : undefined

      const createdIds: string[] = []
      for (const keyId of ids) {
        const created = await keyLoanService.create({
          keys: JSON.stringify([keyId]),
          lease: lease.leaseId,
          contact,
          pickedUpAt: new Date().toISOString(),
          createdBy: 'ui',
        })
        if (created.id) createdIds.push(created.id)
      }

      await refreshLoans()
      openReceiptDialog('loan', ids, createdIds)
      setSelectedKeys([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturnKey = async (keyId: string) => {
    const loan = activeLoanByKeyId.get(keyId)
    if (!loan?.id) return
    setIsProcessing(true)
    try {
      const updated = await keyLoanService.update(loan.id, {
        returnedAt: new Date().toISOString(),
        availableToNextTenantFrom: new Date().toISOString(),
        updatedBy: 'ui',
      })
      await refreshLoans()
      openReceiptDialog(
        'return',
        [keyId],
        [updated.id!],
        updated.returnedAt ?? updated.updatedAt
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturnAll = async () => {
    const active = keys.filter((k) => activeLoanByKeyId.has(k.id))
    if (active.length === 0) return
    setIsProcessing(true)
    try {
      const updatedIds: string[] = []
      for (const k of active) {
        const l = activeLoanByKeyId.get(k.id)!
        const u = await keyLoanService.update(l.id!, {
          returnedAt: new Date().toISOString(),
          availableToNextTenantFrom: new Date().toISOString(),
          updatedBy: 'ui',
        })
        updatedIds.push(u.id!)
      }
      await refreshLoans()
      openReceiptDialog(
        'return',
        active.map((k) => k.id),
        updatedIds
      )
      setSelectedKeys([])
    } finally {
      setIsProcessing(false)
    }
  }

  // ----- Derived for header chips -----
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    keys.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [keys])

  if (loadingKeys) {
    return <div className="text-xs text-muted-foreground">Hämtar nycklar…</div>
  }

  return (
    <>
      <Card className="mt-2">
        <CardContent className="space-y-4 p-3">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KeyTypeLabels) as KeyType[]).map((t) => {
              const n = countsByType.get(t) ?? 0
              if (!n) return null
              return (
                <Badge key={t} variant="secondary" className="text-xs">
                  {KeyTypeLabels[t]}: {n}
                </Badge>
              )
            })}
          </div>

          {/* Bulk actions */}
          <div className="flex flex-wrap items-center gap-2">
            {availableKeys.length > 0 && (
              <Button
                size="sm"
                onClick={handleLoanAll}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Låna ut alla nycklar ({availableKeys.length})
              </Button>
            )}
            {loanedKeys.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReturnAll}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Minus className="h-3 w-3" />
                Återlämna alla nycklar ({loanedKeys.length})
              </Button>
            )}
          </div>

          {/* Keys list */}
          <div className="space-y-1">
            {keys.map((key, index) => {
              const status = getStatus(key.id)
              const isLoaned = status === 'loaned'
              const isReturned = status === 'returned'
              const canBeLoaned = !isLoaned

              return (
                <div
                  key={key.id}
                  className={`flex items-center justify-between py-2 px-1 ${index > 0 ? 'border-t border-border/50' : ''}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {canBeLoaned && (
                      <Checkbox
                        checked={selectedKeys.includes(key.id)}
                        onCheckedChange={(checked) =>
                          toggleSelection(key.id, Boolean(checked))
                        }
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
                    {isLoaned ? (
                      <>
                        <span className="text-xs text-destructive font-medium">
                          Utlånad
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReturnKey(key.id)}
                          disabled={isProcessing}
                          className="h-6 px-2 text-xs"
                        >
                          Återlämna
                        </Button>
                      </>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          isReturned
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {isReturned
                          ? 'Återlämnad (kan lånas ut igen)'
                          : 'Aldrig utlånad'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {selectedKeys.length > 0 && (
            <div className="flex justify-end items-center pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleLoanSelected}
                disabled={isProcessing}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Låna ut valda ({selectedKeys.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ReceiptDialog
        isOpen={showReceiptDialog}
        onClose={() => {
          setShowReceiptDialog(false)
          setReceiptData(null)
          setLastTransactionKeyLoanIds([])
        }}
        receiptData={receiptData}
        keyLoanIds={lastTransactionKeyLoanIds}
      />
    </>
  )
}
