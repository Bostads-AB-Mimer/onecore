// components/loan/EmbeddedKeysList.tsx
import { useEffect, useMemo, useState } from 'react'
import type { Key, Lease, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus } from 'lucide-react'
import { generateMockKeys, countKeysByType } from '@/mockdata/mock-keys'

type LoanStatus = 'never_loaned' | 'loaned' | 'returned'

export function EmbeddedKeysList({ lease }: { lease: Lease }) {
  const [keys, setKeys] = useState<Key[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [loanedKeyIds, setLoanedKeyIds] = useState<Set<string>>(new Set())
  const [returnedKeyIds, setReturnedKeyIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastTransactionType, setLastTransactionType] = useState<
    'loan' | 'return' | null
  >(null)
  const [lastTransactionKeyIds, setLastTransactionKeyIds] = useState<string[]>(
    []
  )

  useEffect(() => {
    setKeys(generateMockKeys(lease.leaseId))
    setSelectedKeys([])
    setLoanedKeyIds(new Set())
    setReturnedKeyIds(new Set())
    setIsProcessing(false)
    setLastTransactionType(null)
    setLastTransactionKeyIds([])
  }, [lease.leaseId])

  const getStatus = (id: string): LoanStatus => {
    if (loanedKeyIds.has(id)) return 'loaned'
    if (returnedKeyIds.has(id)) return 'returned'
    return 'never_loaned'
  }

  const availableKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) !== 'loaned'),
    [keys, loanedKeyIds, returnedKeyIds]
  )
  const loanedKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) === 'loaned'),
    [keys, loanedKeyIds, returnedKeyIds]
  )

  const countsByType = useMemo(() => countKeysByType(keys), [keys])

  const toggleSelection = (keyId: string, checked: boolean) => {
    setSelectedKeys((prev) =>
      checked ? [...prev, keyId] : prev.filter((id) => id !== keyId)
    )
  }

  const handleLoanSelected = () => {
    if (selectedKeys.length === 0) return
    setIsProcessing(true)
    const nextLoaned = new Set(loanedKeyIds)
    selectedKeys.forEach((id) => {
      nextLoaned.add(id)
      if (returnedKeyIds.has(id)) returnedKeyIds.delete(id)
    })
    setLoanedKeyIds(nextLoaned)
    setSelectedKeys([])
    setLastTransactionType('loan')
    setLastTransactionKeyIds(selectedKeys)
    setIsProcessing(false)
  }

  const handleLoanAll = () => {
    const ids = availableKeys.map((k) => k.id)
    if (ids.length === 0) return
    setIsProcessing(true)
    const nextLoaned = new Set(loanedKeyIds)
    ids.forEach((id) => {
      nextLoaned.add(id)
      if (returnedKeyIds.has(id)) returnedKeyIds.delete(id)
    })
    setLoanedKeyIds(nextLoaned)
    setSelectedKeys([])
    setLastTransactionType('loan')
    setLastTransactionKeyIds(ids)
    setIsProcessing(false)
  }

  const handleReturnKey = (id: string) => {
    if (!loanedKeyIds.has(id)) return
    setIsProcessing(true)
    const nextLoaned = new Set(loanedKeyIds)
    const nextReturned = new Set(returnedKeyIds)
    nextLoaned.delete(id)
    nextReturned.add(id)
    setLoanedKeyIds(nextLoaned)
    setReturnedKeyIds(nextReturned)
    setLastTransactionType('return')
    setLastTransactionKeyIds([id])
    setIsProcessing(false)
  }

  const handleReturnAll = () => {
    if (loanedKeys.length === 0) return
    setIsProcessing(true)
    const nextReturned = new Set(returnedKeyIds)
    const returningIds = loanedKeys.map((k) => k.id)
    returningIds.forEach((id) => nextReturned.add(id))
    setLoanedKeyIds(new Set())
    setReturnedKeyIds(nextReturned)
    setSelectedKeys([])
    setLastTransactionType('return')
    setLastTransactionKeyIds(returningIds)
    setIsProcessing(false)
  }

  return (
    <Card className="mt-2">
      <CardContent className="space-y-4 p-3">
        {/* Summary badges (same data ContractCard will show) */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KeyTypeLabels) as KeyType[]).map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {KeyTypeLabels[t]}: {countsByType[t] ?? 0}
            </Badge>
          ))}
        </div>

        {/* Bulk action (placeholder) */}
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
            const isLoaned = loanedKeyIds.has(key.id)
            const isReturned = returnedKeyIds.has(key.id)
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
                      <span className="font-medium text-sm">{key.keyName}</span>
                      <span className="text-xs text-muted-foreground">
                        {KeyTypeLabels[key.keyType as KeyType] ?? key.keyType}
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
                      className={`text-xs font-medium ${isReturned ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}
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

        {lastTransactionType && lastTransactionKeyIds.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm font-medium mb-1">Kvitto (placeholder)</p>
            <p className="text-xs text-muted-foreground">
              Typ: {lastTransactionType === 'loan' ? 'Utlåning' : 'Återlämning'}
            </p>
            <p className="text-xs text-muted-foreground">
              Nycklar: {lastTransactionKeyIds.join(', ')}
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              Historik (placeholder) kommer visas här.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
