import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { FileText, Printer, Calendar, ChevronDown, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type { Lease, Receipt, KeyLoan, Key } from '@/services/types'
import { toReceiptTenant } from '@/services/types'
import { generateLoanReceipt, generateReturnReceipt } from '@/lib/pdf-receipts'
import { receiptService } from '@/services/api/receiptService'
import { keyLoanService } from '@/services/api/keyLoanService'

type LoanTransaction = {
  id: string
  type: 'loan' | 'return'
  date: string // ISO
  keyLoanIds: string[]
  keys: Array<{ id: string; key_name: string; key_type: string }>
}

export function ReceiptHistory({ lease }: { lease: Lease }) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [transactions, setTransactions] = useState<LoanTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [r, keyLoans] = await Promise.all([
          receiptService.listByLease(lease.leaseId),
          keyLoanService.listByLease(lease.leaseId), // returns { loaned, returned }
        ])
        if (cancelled) return
        setReceipts(r)
        setTransactions(
          buildTransactions(
            keyLoans.loaned,
            keyLoans.returned,
            r,
            lease.leaseId
          )
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lease.leaseId])

  function buildTransactions(
    loaned: KeyLoan[],
    returned: KeyLoan[],
    existingReceipts: Receipt[],
    leaseId: string
  ): LoanTransaction[] {
    const existingIds = new Set(existingReceipts.flatMap((r) => r.keyLoanIds))

    const parseKeysCsv = (csv?: string): string[] =>
      String(csv ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

    const groupByDay = (
      items: KeyLoan[],
      kind: 'loan' | 'return'
    ): LoanTransaction[] => {
      // exclude loans already included in receipts
      const usable = items.filter((l) => !existingIds.has(l.id))
      if (!usable.length) return []

      // group by YYYY-MM-DD based on createdAt / returnedAt
      const byDay = new Map<string, KeyLoan[]>()
      for (const l of usable) {
        const dateIso =
          kind === 'loan' ? l.createdAt : (l.returnedAt ?? l.createdAt)
        const day = (dateIso ?? '').slice(0, 10)
        const arr = byDay.get(day) ?? []
        arr.push(l)
        byDay.set(day, arr)
      }

      const tx: LoanTransaction[] = []
      byDay.forEach((arr) => {
        const dateIso =
          kind === 'loan'
            ? arr[0].createdAt
            : (arr[0].returnedAt ?? arr[0].createdAt)

        // Flatten all key ids from CSV across the loans in this day-group
        const keyIds = arr.flatMap((kl) => parseKeysCsv((kl as any).keys))

        tx.push({
          id: `${kind}-${leaseId}-${arr[0].id}`,
          type: kind,
          date: dateIso!,
          keyLoanIds: arr.map((x) => x.id),
          // simple display labels; replace when you have richer key metadata
          keys: keyIds.map((id) => ({
            id,
            key_name: `Nyckel ${id.slice(0, 4)}`,
            key_type: 'Okänd',
          })),
        })
      })
      return tx
    }

    return [
      ...groupByDay(loaned, 'loan'),
      ...groupByDay(returned, 'return'),
    ].sort((a, b) => b.date.localeCompare(a.date))
  }

  const currentReceiptTenants = () => {
    return lease.tenants && lease.tenants.length > 0
      ? lease.tenants.map(toReceiptTenant)
      : [
          {
            id: '',
            personnummer: '',
            firstName: 'Okänd',
            lastName: 'Hyresgäst',
          },
        ]
  }

  const handleReprint = (receipt: Receipt) => {
    const tenants = currentReceiptTenants()
    const keys: Key[] = [] // If you want actual key rows on the PDF, fetch them by receipt/keyLoanIds
    if (receipt.receiptType === 'loan') {
      generateLoanReceipt({ lease, tenants, keys, receiptType: 'loan' })
    } else {
      generateReturnReceipt({ lease, tenants, keys, receiptType: 'return' })
    }
  }

  const handleGenerateFromTx = async (tx: LoanTransaction) => {
    const tenants = currentReceiptTenants()
    const receiptNumber = `${tx.type === 'loan' ? 'NYL' : 'NYÅ'}-${format(
      new Date(),
      'yyyyMMdd-HHmmss'
    )}`

    // Persist receipt
    await receiptService.create({
      receiptType: tx.type,
      leaseId: lease.leaseId,
      tenantId: tenants[0].id,
      keyLoanIds: tx.keyLoanIds,
      receiptNumber,
    })

    // Print (optional: supply real key rows)
    const keys: Key[] = []
    if (tx.type === 'loan') {
      generateLoanReceipt({
        lease,
        tenants,
        keys,
        receiptType: 'loan',
        operationDate: new Date(tx.date),
      })
    } else {
      generateReturnReceipt({
        lease,
        tenants,
        keys,
        receiptType: 'return',
        operationDate: new Date(tx.date),
      })
    }

    // Refresh
    const [r, keyLoans] = await Promise.all([
      receiptService.listByLease(lease.leaseId),
      keyLoanService.listByLease(lease.leaseId),
    ])
    setReceipts(r)
    setTransactions(
      buildTransactions(keyLoans.loaned, keyLoans.returned, r, lease.leaseId)
    )
  }

  if (loading)
    return (
      <div className="text-sm text-muted-foreground p-2">Laddar kvitton...</div>
    )
  if (receipts.length === 0 && transactions.length === 0) return null

  const total = receipts.length + transactions.length

  return (
    <Collapsible defaultOpen={false} className="w-full">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>Kvittohistorik ({total} poster)</span>
        </div>
        <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 p-2 pt-4">
        {receipts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
              <Printer className="h-3 w-3" />
              <span>BEFINTLIGA KVITTON ({receipts.length})</span>
            </div>
            {receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{r.receiptNumber}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(r.createdAt), "d MMM yyyy 'kl.' HH:mm", {
                        locale: sv,
                      })}
                    </div>
                  </div>
                  <Badge
                    variant={r.receiptType === 'loan' ? 'default' : 'secondary'}
                  >
                    {r.receiptType === 'loan' ? 'Utlåning' : 'Återlämning'}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReprint(r)}
                  className="gap-2"
                >
                  <Printer className="h-3 w-3" />
                  Skriv om
                </Button>
              </div>
            ))}
          </div>
        )}

        {transactions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
              <Plus className="h-3 w-3" />
              <span>
                TILLGÄNGLIGA FÖR KVITTOGENERERING ({transactions.length})
              </span>
            </div>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 border rounded-lg border-dashed"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">
                      {tx.keys.map((k) => k.key_name).join(', ') || 'Nycklar'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(tx.date), "d MMM yyyy 'kl.' HH:mm", {
                        locale: sv,
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tx.keys.length} nyckel{tx.keys.length !== 1 ? 'ar' : ''}
                    </p>
                  </div>
                  <Badge
                    variant={tx.type === 'loan' ? 'outline' : 'secondary'}
                    className="border-dashed"
                  >
                    {tx.type === 'loan' ? 'Utlåning' : 'Återlämning'}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateFromTx(tx)}
                  className="gap-2 border-dashed"
                >
                  <Plus className="h-3 w-3" />
                  Skapa kvitto
                </Button>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
