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
import { KeyTypeLabels } from '@/services/types'
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
import { getKeyLoanStatus, type KeyLoanInfo } from '@/utils/keyLoanStatus'

const EXTRA_KEY_TYPE: KeyType = 'LGH'

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
  const [lastTransactionKeyLoanId, setLastTransactionKeyLoanId] = useState<
    string | null
  >(null)

  // --- Create LGH key ---
  const [createLghMode, setCreateLghMode] = useState(false)
  const [draftName, setDraftName] = useState('')

  const [defaultKeySystem, setDefaultKeySystem] = useState<KeySystem | null>(
    null
  )

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

  const effectiveDefaultKeySystemId = useMemo(
    () => defaultKeySystemId(),
    [defaultKeySystemId]
  )

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
        if (!cancelled) setDefaultKeySystem(ks ?? null)
      } catch {
        if (!cancelled) setDefaultKeySystem(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [effectiveDefaultKeySystemId])

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

  useEffect(() => {
    setKeys(initialKeys)
  }, [initialKeys])

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
    if (activeLoan) {
      const loanLease = activeLoan.lease?.trim()
      const currentLease = lease.leaseId?.trim()
      return loanLease === currentLease
        ? 'loaned_to_customer'
        : 'loaned_to_other'
    }
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

  const loanedToThisLeaseKeys = useMemo(
    () => keys.filter((k) => getStatus(k.id) === 'loaned_to_customer'),
    [keys, loans, lease.leaseId]
  )

  const toggleSelection = (keyId: string, checked: boolean) => {
    setSelectedKeys((prev) =>
      checked ? [...prev, keyId] : prev.filter((id) => id !== keyId)
    )
  }

  // ---- Selection buckets ----
  const selectedForLoan = useMemo(
    () =>
      selectedKeys.filter((id) =>
        ['never_loaned', 'returned'].includes(getStatus(id))
      ),
    [selectedKeys, loans]
  )
  const selectedForReturn = useMemo(
    () => selectedKeys.filter((id) => getStatus(id) === 'loaned_to_customer'),
    [selectedKeys, loans]
  )

  // ---- Receipt helpers ----
  const openReceiptDialog = (
    type: 'loan' | 'return',
    keyIds: string[],
    keyLoanId: string,
    when?: string
  ) => {
    const tenants = lease.tenants ?? []
    const relevantKeys = keys.filter((k) => keyIds.includes(k.id))
    setReceiptData({
      lease,
      tenants,
      keys: relevantKeys,
      receiptType: type === 'loan' ? 'LOAN' : 'RETURN',
      operationDate: when ? new Date(when) : new Date(),
    })
    setLastTransactionKeyLoanId(keyLoanId)
    setShowReceiptDialog(true)
  }

  // ---- Actions: LOAN (selected) ----
  const handleLoanSelected = async (keyIds = selectedForLoan) => {
    if (keyIds.length === 0) return
    setIsProcessing(true)
    try {
      const { contact, contact2 } = deriveContacts(lease)

      // Create ONE key_loan record with ALL selected keys
      try {
        const created = await keyLoanService.create({
          keys: JSON.stringify(keyIds), // All keys in one transaction
          lease: lease.leaseId,
          contact,
          contact2,
          pickedUpAt: null, // Pending - will be set when signed receipt is uploaded
          createdBy: 'ui',
        })

        if (created.id) {
          await refreshLoans()
          openReceiptDialog('loan', keyIds, created.id) // Single keyLoanId
          setSelectedKeys((prev) => prev.filter((id) => !keyIds.includes(id)))
        }
      } catch (err: any) {
        if (isConflict(err)) {
          toast({
            title: 'Kan inte låna ut',
            description: 'En eller flera nycklar är redan utlånade.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Fel',
            description:
              httpData(err)?.message ||
              httpData(err)?.error ||
              err?.message ||
              'Kunde inte skapa nyckellån.',
            variant: 'destructive',
          })
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // ---- Actions: RETURN (selected) ----
  const handleReturnSelected = async (keyIds = selectedForReturn) => {
    if (keyIds.length === 0) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      let firstLoanId: string | null = null

      // Update all existing loans with returnedAt and track the first loan ID
      for (const keyId of keyIds) {
        const active = activeLoanByKeyId.get(keyId)
        if (!active) continue
        if (!firstLoanId) firstLoanId = active.id // Use the first loan's ID for the receipt
        try {
          await keyLoanService.update(active.id, {
            returnedAt: now,
            availableToNextTenantFrom: now,
          } as any)
        } catch (err: any) {
          toast({
            title: 'Kunde inte ta emot nyckel',
            description: httpData(err)?.message || err?.message || 'Okänt fel',
            variant: 'destructive',
          })
        }
      }

      // Create return receipt linked to the SAME key_loan (use first loan ID)
      if (firstLoanId) {
        await refreshLoans()
        openReceiptDialog('return', keyIds, firstLoanId, now)
        setSelectedKeys((prev) => prev.filter((id) => !keyIds.includes(id)))
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // ---- Batch (“alla”) helpers ----
  const allAvailableForLoanIds = useMemo(
    () => availableKeys.map((k) => k.id),
    [availableKeys]
  )
  const allReturnableIds = useMemo(
    () => loanedToThisLeaseKeys.map((k) => k.id),
    [loanedToThisLeaseKeys]
  )

  // Single button that switches label depending on state:
  // If there are any keys loaned to this lease -> show "Återlämna alla".
  // Otherwise -> show "Låna ut alla".
  const showReturnAll = allReturnableIds.length > 0
  const batchButtonLabel = showReturnAll
    ? `Återlämna alla (${allReturnableIds.length})`
    : `Låna ut alla (${allAvailableForLoanIds.length})`
  const batchButtonDisabled =
    isProcessing ||
    (showReturnAll
      ? allReturnableIds.length === 0
      : allAvailableForLoanIds.length === 0)
  const handleBatchClick = () => {
    if (showReturnAll) return handleReturnSelected(allReturnableIds)
    return handleLoanSelected(allAvailableForLoanIds)
  }

  // ----- Derived for header chips -----
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    keys.forEach((k) => m.set(k.keyType, (m.get(k.keyType) ?? 0) + 1))
    return m
  }, [keys])

  // ----- Sorted list -----
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

          {/* Bulk actions & LGH create */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Batch button that toggles */}
            <Button
              size="sm"
              onClick={handleBatchClick}
              disabled={batchButtonDisabled}
              className="flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              {batchButtonLabel}
            </Button>

            {/* Keep “selected” options */}
            {selectedForLoan.length > 0 && (
              <Button
                size="sm"
                onClick={() => handleLoanSelected()}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Låna ut valda ({selectedForLoan.length})
              </Button>
            )}

            {selectedForReturn.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleReturnSelected()}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                Ta emot valda ({selectedForReturn.length})
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
              const canBeReturned = isLoanedToCustomer
              const isSelectable = canBeLoaned || canBeReturned

              return (
                <div
                  key={key.id}
                  className={`flex items-center justify-between py-2 px-1 ${index > 0 ? 'border-t border-border/50' : ''}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {isSelectable && (
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
                        className={`text-xs font-medium ${isReturned ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}
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
        </CardContent>
      </Card>

      <ReceiptDialog
        isOpen={showReceiptDialog}
        onClose={() => {
          setShowReceiptDialog(false)
          setReceiptData(null)
          setLastTransactionKeyLoanId(null)
        }}
        receiptData={receiptData}
        keyLoanId={lastTransactionKeyLoanId}
      />
    </>
  )

  async function handleCreateLghKey() {
    try {
      const payload = {
        keyName: draftName.trim(),
        keyType: EXTRA_KEY_TYPE,
        keySequenceNumber: nextSeqForLGH,
        rentalObjectCode: lease.rentalPropertyId,
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
}
