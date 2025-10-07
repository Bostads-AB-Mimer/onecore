import { useEffect, useMemo, useState, useCallback } from 'react'
import type {
  Key,
  Lease,
  KeyType,
  ReceiptData,
  KeyLoan,
  KeySystem,
} from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { KeyTypeLabels, toReceiptTenant } from '@/services/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus } from 'lucide-react'
import { ReceiptDialog } from './ReceiptDialog'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'

type LoanStatus =
  | 'never_loaned'
  | 'loaned_to_customer'
  | 'loaned_to_other'
  | 'returned'

// Only LGH is allowed for extra creation
const EXTRA_KEY_TYPE: KeyType = 'LGH'

// Sort order for groups in the list
const KEY_TYPE_ORDER: Partial<Record<KeyType, number>> = {
  LGH: 1,
  PB: 2,
  FS: 3,
  HN: 4,
}

// --- normalize error shapes (axios/fetch/custom) ---
const httpStatus = (e: any) =>
  e?.status ?? e?.statusCode ?? e?.response?.status ?? e?.cause?.status
const httpData = (e: any) => e?.data ?? e?.response?.data ?? e?.body
const isConflict = (e: any) => {
  const s = httpStatus(e)
  if (s === 409) return true
  const msg = String(e?.message ?? '').toLowerCase()
  const dataStr = JSON.stringify(httpData(e) ?? {}).toLowerCase()
  return (
    msg.includes('409') ||
    msg.includes('conflict') ||
    dataStr.includes('"status":409') ||
    dataStr.includes('conflict')
  )
}

// pull up to two contacts from lease.tenants
function deriveContacts(lease: Lease): { contact?: string; contact2?: string } {
  const names = (lease.tenants ?? [])
    .slice(0, 2)
    .map((t) => [t.firstName, t.lastName].filter(Boolean).join(' ').trim())
    .filter(Boolean)
  return { contact: names[0] || undefined, contact2: names[1] || undefined }
}

export function EmbeddedKeysList({
  lease,
  initialKeys = [],
}: {
  lease: Lease
  initialKeys?: Key[]
}) {
  const { toast } = useToast()

  const [keys, setKeys] = useState<Key[]>(initialKeys)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [loans, setLoans] = useState<KeyLoan[]>([])
  const [loadingLoans, setLoadingLoans] = useState(false)

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [showReceiptDialog, setShowReceiptDialog] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [lastTransactionKeyLoanIds, setLastTransactionKeyLoanIds] = useState<
    string[]
  >([])

  // --- Create extra LGH key ---
  const [createLghMode, setCreateLghMode] = useState(false)
  const [draftName, setDraftName] = useState('')

  // Keep the default KeySystem object so we can display its code
  const [defaultKeySystem, setDefaultKeySystem] = useState<KeySystem | null>(
    null
  )

  // next löp for LGH on this object
  const nextSeqForLGH = useMemo(() => {
    const seqs = keys
      .filter(
        (k) =>
          k.rentalObjectCode === lease.rentalPropertyId &&
          k.keyType === EXTRA_KEY_TYPE
      )
      .map((k) => Number(k.keySequenceNumber || 0))
    const max = seqs.length ? Math.max(...seqs) : 0
    return max + 1
  }, [keys, lease.rentalPropertyId])

  // default keySystemId on this object (prefer LGH, else any)
  const defaultKeySystemId = useCallback(() => {
    const sameType = keys.find(
      (k) =>
        k.rentalObjectCode === lease.rentalPropertyId &&
        k.keyType === EXTRA_KEY_TYPE &&
        k.keySystemId
    )
    if (sameType?.keySystemId) return sameType.keySystemId
    const anyOnObject = keys.find(
      (k) => k.rentalObjectCode === lease.rentalPropertyId && k.keySystemId
    )
    return anyOnObject?.keySystemId ?? ''
  }, [keys, lease.rentalPropertyId])

  // Effective id (memoized) so we can fetch the KeySystem once per change
  const effectiveDefaultKeySystemId = useMemo(
    () => defaultKeySystemId(),
    [defaultKeySystemId]
  )

  // Fetch the KeySystem to show system code in the form
  useEffect(() => {
    let cancelled = false
    const id = effectiveDefaultKeySystemId
    if (!id) {
      setDefaultKeySystem(null)
      return
    }
    ;(async () => {
      try {
        const ks = await (keyService as any).getKeySystem?.(id)
        // If your API has a different method name, adjust here.
        if (!cancelled) setDefaultKeySystem(ks ?? null)
      } catch {
        if (!cancelled) setDefaultKeySystem(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [effectiveDefaultKeySystemId])

  // Human-friendly display for the key system: prefer systemCode, fall back
  const keySystemDisplayCode = useMemo(() => {
    const ks = defaultKeySystem as any
    return (
      ks?.systemCode ??
      ks?.system_code ??
      ks?.systemcode ??
      ks?.name ??
      effectiveDefaultKeySystemId ??
      '—'
    )
  }, [defaultKeySystem, effectiveDefaultKeySystemId])

  // keep keys in sync
  useEffect(() => {
    setKeys(initialKeys)
  }, [initialKeys])

  // fetch keys if not provided
  useEffect(() => {
    if (initialKeys.length > 0) return
    let cancelled = false
    ;(async () => {
      setLoadingKeys(true)
      try {
        const list = await keyService.searchKeys({
          rentalObjectCode: lease.rentalPropertyId,
        })
        if (!cancelled) setKeys(list.content)
      } finally {
        if (!cancelled) setLoadingKeys(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId, initialKeys.length])

  // Load loans relevant to these keys
  const refreshLoans = useCallback(async () => {
    setLoadingLoans(true)
    try {
      const allLoans = await keyLoanService.list()
      const keyIds = keys.map((k) => k.id)
      const relevant = allLoans.filter((loan) => {
        try {
          const loanKeyIds = JSON.parse(loan.keys ?? '[]') as string[]
          return loanKeyIds.some((id) => keyIds.includes(id))
        } catch {
          return false
        }
      })
      setLoans(relevant)
    } finally {
      setLoadingLoans(false)
    }
  }, [keys])

  useEffect(() => {
    refreshLoans()
  }, [refreshLoans])

  // --- Status helpers ---
  const activeLoanByKeyId = useMemo(() => {
    const m = new Map<string, KeyLoan>()
    for (const l of loans) {
      if (!l.returnedAt) {
        try {
          const keyIds = JSON.parse(l.keys ?? '[]') as string[]
          keyIds.forEach((id) => m.set(id, l))
        } catch {}
      }
    }
    return m
  }, [loans])

  const getStatus = (keyId: string): LoanStatus => {
    const activeLoan = activeLoanByKeyId.get(keyId)
    if (activeLoan)
      return activeLoan.lease === lease.leaseId
        ? 'loaned_to_customer'
        : 'loaned_to_other'
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
    () =>
      keys.filter(
        (k) =>
          !['loaned_to_customer', 'loaned_to_other'].includes(getStatus(k.id))
      ),
    [keys, loans, lease.leaseId]
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
    const tenants =
      lease.tenants && lease.tenants.length > 0
        ? lease.tenants.map(toReceiptTenant)
        : [
            {
              id: '',
              personnummer: '',
              firstName: 'Okänd',
              lastName: 'Hyresgäst',
            },
          ]
    const relevantKeys = keys.filter((k) => keyIds.includes(k.id))
    setReceiptData({
      lease,
      tenants,
      keys: relevantKeys,
      receiptType: type,
      operationDate: when ? new Date(when) : new Date(),
    })
    setLastTransactionKeyLoanIds(keyLoanIds)
    setShowReceiptDialog(true)
  }

  // ---- Actions ----
  const handleLoanSelected = async () => {
    if (selectedKeys.length === 0) return
    setIsProcessing(true)
    try {
      const { contact, contact2 } = deriveContacts(lease)
      const createdIds: string[] = []
      for (const keyId of selectedKeys) {
        try {
          const created = await keyLoanService.create({
            keys: JSON.stringify([keyId]),
            lease: lease.leaseId,
            contact,
            contact2,
            pickedUpAt: new Date().toISOString(),
            createdBy: 'ui',
          })
          if (created.id) createdIds.push(created.id)
        } catch (err: any) {
          if (isConflict(err)) {
            const k = keys.find((k) => k.id === keyId)
            toast({
              title: 'Kan inte låna ut',
              description: `Nyckeln ${k?.keyName ?? keyId} är redan utlånad.`,
              variant: 'destructive',
            })
            continue
          }
          const msg =
            httpData(err)?.message ||
            httpData(err)?.error ||
            err?.message ||
            'Kunde inte skapa nyckellån.'
          toast({ title: 'Fel', description: msg, variant: 'destructive' })
        }
      }
      if (createdIds.length > 0) {
        await refreshLoans()
        openReceiptDialog('loan', selectedKeys, createdIds)
        setSelectedKeys([])
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateLghKey = async () => {
    try {
      const payload = {
        keyName: draftName.trim(),
        keyType: EXTRA_KEY_TYPE,
        keySequenceNumber: nextSeqForLGH,
        rentalObjectCode: lease.rentalPropertyId,
        // Still send the *id* to the API
        keySystemId: effectiveDefaultKeySystemId || undefined,
      }
      const created = await keyService.createKey(payload)
      setKeys((prev) => [...prev, created])
      setDraftName('')
      setCreateLghMode(false)
      toast({
        title: 'Nyckel skapad',
        description: `${created.keyName} (${KeyTypeLabels[EXTRA_KEY_TYPE]}) – Löp ${created.keySequenceNumber}`,
      })
    } catch (e: any) {
      toast({
        title: 'Kunde inte skapa nyckel',
        description: e?.message ?? 'Okänt fel',
        variant: 'destructive',
      })
    }
  }

  // ----- Derived for header chips -----
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    keys.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [keys])

  // ----- Sorted list (type → LÖP → createdAt → name) -----
  const sortedKeys = useMemo(() => {
    const getTypeRank = (t: KeyType) => KEY_TYPE_ORDER[t] ?? 999
    const getSeq = (k: Key) =>
      k.keySequenceNumber == null
        ? Number.POSITIVE_INFINITY
        : Number(k.keySequenceNumber)
    return [...keys].sort((a, b) => {
      const typeCmp =
        getTypeRank(a.keyType as KeyType) - getTypeRank(b.keyType as KeyType)
      if (typeCmp !== 0) return typeCmp
      const seqCmp = getSeq(a) - getSeq(b)
      if (seqCmp !== 0) return seqCmp
      const ac = a.createdAt
        ? new Date(a.createdAt).getTime()
        : Number.POSITIVE_INFINITY
      const bc = b.createdAt
        ? new Date(b.createdAt).getTime()
        : Number.POSITIVE_INFINITY
      if (ac !== bc) return ac - bc
      return (a.keyName || '').localeCompare(b.keyName || '')
    })
  }, [keys])

  if (loadingKeys)
    return <div className="text-xs text-muted-foreground">Hämtar nycklar…</div>

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
          </div>

          {/* Bulk & LGH create */}
          <div className="flex flex-wrap items-center gap-2">
            {availableKeys.length > 0 && (
              <Button
                size="sm"
                onClick={handleLoanSelected}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Låna ut valda ({selectedKeys.length})
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateLghMode(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Skapa LGH-nyckel (Löp {nextSeqForLGH})
            </Button>
          </div>

          {/* Minimal LGH create form */}
          {createLghMode && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="col-span-1 md:col-span-2">
                  <label className="text-xs block mb-1">Nyckelnamn *</label>
                  <input
                    className="h-8 w-full border rounded px-2 bg-background"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={`t.ex. LGH-${nextSeqForLGH}`}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1">Typ</label>
                  <input
                    className="h-8 w-full border rounded px-2 bg-muted text-muted-foreground"
                    value={KeyTypeLabels[EXTRA_KEY_TYPE]}
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1">Löpnummer</label>
                  <input
                    className="h-8 w-full border rounded px-2 bg-muted text-muted-foreground"
                    value={nextSeqForLGH}
                    readOnly
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <span className="mr-3">
                  Objekt-ID: {lease.rentalPropertyId}
                </span>
                <span className="mr-3">Låssystem: {keySystemDisplayCode}</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreateLghMode(false)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  disabled={!draftName.trim()}
                  onClick={handleCreateLghKey}
                >
                  Skapa
                </Button>
              </div>
            </div>
          )}

          {/* Keys list */}
          <div className="space-y-1">
            {sortedKeys.map((key, index) => {
              const status = getStatus(key.id)
              const isLoanedToCustomer = status === 'loaned_to_customer'
              const isLoanedToOther = status === 'loaned_to_other'
              const isReturned = status === 'returned'
              const canBeLoaned = !isLoanedToCustomer && !isLoanedToOther

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
                          setSelectedKeys((prev) =>
                            checked
                              ? [...prev, key.id]
                              : prev.filter((id) => id !== key.id)
                          )
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
                    {isLoanedToCustomer ? (
                      <span className="text-xs text-destructive font-medium">
                        Utlånad till kund
                      </span>
                    ) : isLoanedToOther ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium cursor-help">
                              Utlånad till annan hyresgäst
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Utlånad till kontrakt:{' '}
                              {activeLoanByKeyId.get(key.id)?.lease || 'Okänt'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                          : 'Ej utlånad'}
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
