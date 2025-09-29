import { useEffect, useMemo, useState } from 'react'
import type { Key, Lease, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus } from 'lucide-react'

/** Seeded number in [min,max], stable per (leaseId, suffix) */
function seededRange(
  leaseId: string,
  suffix: string,
  min: number,
  max: number
) {
  const seed = `${leaseId}:${suffix}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return (hash % (max - min + 1)) + min
}

/** One fixed object number (1..999) per type on a lease (e.g., Lägenhet 945) */
function objectNumberForType(leaseId: string, type: KeyType): number {
  return seededRange(leaseId, `${type}-obj`, 1, 999)
}

/** Generate mock keys with the exact requested ranges */
function generateMockKeys(leaseId: string): Key[] {
  const keys: Key[] = []
  let counter = 1

  // Only mock these four types; others 0 so they won't render.
  const spec: Partial<Record<KeyType, [number, number]>> = {
    LGH: [2, 5], // Lägenhet: 2–5 keys to the same apartment number
    PB: [1, 3], // Postbox: 1–3 keys to the same postbox number
    TP: [1, 3], // Trapphus: 1–3 keys to the same trapphus number
    GEM: [1, 3], // Gemensamt: 1–3 keys to the same shared-area number
    // HUS, FS, HN: intentionally omitted (0)
  }

  ;(Object.keys(spec) as KeyType[]).forEach((type) => {
    const [min, max] = spec[type]!
    const objNo = objectNumberForType(leaseId, type) // 1..999, fixed per lease+type
    const count = seededRange(leaseId, `${type}-count`, min, max)

    for (let i = 1; i <= count; i++) {
      keys.push({
        id: `${type}-${counter}`,
        keyName: `${KeyTypeLabels[type]} ${objNo}`, // same object; LÖP differentiates keys
        keyType: type as Key['keyType'] & KeyType, // ensure compatible with API's union
        keySequenceNumber: i, // LÖP: 1..count
        flexNumber: seededRange(leaseId, `${type}-flex-${i}`, 1, 3), // 1..3 placeholder
        // optional fields from API type — safe placeholders
        rentalObjectCode: String(objNo),
        keySystemId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      counter++
    }
  })

  return keys
}

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
    const mock = generateMockKeys(lease.leaseId)
    setKeys(mock)
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

  const countsByType = useMemo(() => {
    const acc: Record<KeyType, number> = {} as any
    ;(Object.keys(KeyTypeLabels) as KeyType[]).forEach((t) => (acc[t] = 0))
    keys.forEach(
      (k) => (acc[k.keyType as KeyType] = (acc[k.keyType as KeyType] ?? 0) + 1)
    )
    return acc
  }, [keys])

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
        {/* Summary */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KeyTypeLabels) as KeyType[]).map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {KeyTypeLabels[t]}: {countsByType[t] ?? 0}
            </Badge>
          ))}
        </div>

        {/* Bulk Action Buttons (placeholders) */}
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

        {/* Keys List */}
        <div className="space-y-1">
          {keys.map((key, index) => {
            const isLoaned = loanedKeyIds.has(key.id)
            const isReturned = returnedKeyIds.has(key.id)
            const canBeLoaned = !isLoaned

            return (
              <div
                key={key.id}
                className={`flex items-center justify-between py-2 px-1 ${
                  index > 0 ? 'border-t border-border/50' : ''
                }`}
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

        {/* Individual Loan Action (placeholder) */}
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

        {/* Placeholder “receipt” + history */}
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
