import { useEffect, useMemo, useState } from 'react'
import type {
  Key,
  Lease,
  KeyType,
  MockKeyLoan,
  ReceiptData,
} from '@/services/types'
import { KeyTypeLabels, toReceiptTenant } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus } from 'lucide-react'

import { generateMockKeys, countKeysByType } from '@/mockdata/mock-keys'
import { mockKeyLoans } from '@/mockdata/mock-keyloans'
import { ReceiptDialog } from './ReceiptDialog'
import { ReceiptHistory } from './ReceiptHistory'

type LoanStatus = 'never_loaned' | 'loaned' | 'returned'

export function EmbeddedKeysList({ lease }: { lease: Lease }) {
  const [keys, setKeys] = useState<Key[]>([])
  const [activeLoans, setActiveLoans] = useState<MockKeyLoan[]>([])
  const [returnedLoans, setReturnedLoans] = useState<MockKeyLoan[]>([])

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [lastTransactionKeyLoanIds, setLastTransactionKeyLoanIds] = useState<
    string[]
  >([])

  useEffect(() => {
    setKeys(generateMockKeys(lease.leaseId))
    refreshLoans()
    setSelectedKeys([])
    setIsProcessing(false)
    setShowReceiptDialog(false)
    setReceiptData(null)
    setLastTransactionKeyLoanIds([])
  }, [lease.leaseId])

  const refreshLoans = () => {
    const { active, returned } = mockKeyLoans.listByLease(lease.leaseId)
    setActiveLoans(active)
    setReturnedLoans(returned)
  }

  const activeLoanByKeyId = useMemo(() => {
    const m = new Map<string, MockKeyLoan>()
    activeLoans.forEach((l) => m.set(l.keyId, l))
    return m
  }, [activeLoans])

  const getStatus = (keyId: string): LoanStatus => {
    if (activeLoanByKeyId.has(keyId)) return 'loaned'
    if (returnedLoans.some((l) => l.keyId === keyId)) return 'returned'
    return 'never_loaned'
  }

  const availableKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) !== 'loaned'),
    [keys, activeLoanByKeyId, returnedLoans]
  )
  const loanedKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) === 'loaned'),
    [keys, activeLoanByKeyId]
  )

  const countsByType = useMemo(() => countKeysByType(keys), [keys])

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
  const handleLoanSelected = () => {
    if (selectedKeys.length === 0) return
    setIsProcessing(true)

    const t = lease.tenants?.[0]
    const tenantId = t?.contactKey ?? ''
    const created = mockKeyLoans.loanMany({
      lease,
      tenantId,
      keyIds: selectedKeys,
    })
    refreshLoans()
    setSelectedKeys([])

    // Open receipt dialog for this transaction
    openReceiptDialog(
      'loan',
      created.map((c) => c.keyId),
      created.map((c) => c.id),
      created[0]?.createdAt
    )

    setIsProcessing(false)
  }

  const handleLoanAll = () => {
    const ids = availableKeys.map((k) => k.id)
    if (ids.length === 0) return
    setIsProcessing(true)

    const t = lease.tenants?.[0]
    const tenantId = t?.contactKey ?? ''
    const created = mockKeyLoans.loanMany({ lease, tenantId, keyIds: ids })
    refreshLoans()
    setSelectedKeys([])

    openReceiptDialog(
      'loan',
      created.map((c) => c.keyId),
      created.map((c) => c.id),
      created[0]?.createdAt
    )

    setIsProcessing(false)
  }

  const handleReturnKey = (keyId: string) => {
    const loan = activeLoanByKeyId.get(keyId)
    if (!loan) return
    setIsProcessing(true)

    const updated = mockKeyLoans.returnMany([loan.id])
    refreshLoans()

    openReceiptDialog(
      'return',
      [loan.keyId],
      updated.map((u) => u.id),
      updated[0]?.returnedAt ?? updated[0]?.createdAt
    )

    setIsProcessing(false)
  }

  const handleReturnAll = () => {
    if (activeLoans.length === 0) return
    setIsProcessing(true)

    const ids = activeLoans.map((l) => l.id)
    const updated = mockKeyLoans.returnMany(ids)
    refreshLoans()
    setSelectedKeys([])

    openReceiptDialog(
      'return',
      updated.map((u) => u.keyId),
      updated.map((u) => u.id),
      updated[0]?.returnedAt ?? updated[0]?.createdAt
    )

    setIsProcessing(false)
  }

  return (
    <>
      <Card className="mt-2">
        <CardContent className="space-y-4 p-3">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KeyTypeLabels) as KeyType[]).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {KeyTypeLabels[t]}: {countsByType[t] ?? 0}
              </Badge>
            ))}
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
                          {KeyTypeLabels[key.keyType as KeyType] ??
                            (key.keyType as unknown as string)}
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
                        {key.keySystemId && (
                          <span className="text-xs text-muted-foreground">
                            Lås: {key.keySystemId}
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

          {/* Individual loan action */}
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

      {/* Receipt history (mock) */}
      <div className="mt-4">
        <ReceiptHistory lease={lease} />
      </div>

      {/* Receipt dialog (mock save + PDF) */}
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
