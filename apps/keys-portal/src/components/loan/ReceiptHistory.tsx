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

import type {
  Lease,
  Receipt,
  LoanTransaction,
  MockKeyLoan,
  Key,
} from '@/services/types'
import { toReceiptTenant } from '@/services/types'

import { mockReceipts } from '@/mockdata/mock-receipts'
import { mockKeyLoans } from '@/mockdata/mock-keyloans'
import { generateLoanReceipt, generateReturnReceipt } from '@/lib/pdf-receipts'

export function ReceiptHistory({ lease }: { lease: Lease }) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [transactions, setTransactions] = useState<LoanTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const r = mockReceipts.listByLease(lease.leaseId)
    const { active, returned } = mockKeyLoans.listByLease(lease.leaseId)
    setReceipts(r)
    setTransactions(buildTransactions(active, returned))
    setLoading(false)
  }, [lease.leaseId])

  const buildTransactions = (
    active: MockKeyLoan[],
    returned: MockKeyLoan[]
  ): LoanTransaction[] => {
    const existingIds = new Set(
      mockReceipts.listByLease(lease.leaseId).flatMap((r) => r.keyLoanIds)
    )

    const make = (
      type: 'loan' | 'return',
      items: MockKeyLoan[]
    ): LoanTransaction[] => {
      const usable = items.filter((l) => !existingIds.has(l.id))
      if (usable.length === 0) return []

      const byDay = new Map<string, MockKeyLoan[]>()
      usable.forEach((l) => {
        const t = type === 'loan' ? l.createdAt : (l.returnedAt ?? l.createdAt)
        const day = t.slice(0, 10)
        const arr = byDay.get(day) ?? []
        arr.push(l)
        byDay.set(day, arr)
      })

      const tx: LoanTransaction[] = []
      byDay.forEach((arr) => {
        const date =
          type === 'loan'
            ? arr[0].createdAt
            : (arr[0].returnedAt ?? arr[0].createdAt)
        tx.push({
          id: `${type}-${arr[0].id}`,
          type,
          date,
          keyLoanIds: arr.map((x) => x.id),
          keys: arr.map((x) => ({
            id: x.keyId,
            key_name: `Nyckel ${x.keyId.slice(0, 4)}`,
            key_type: 'Okänd',
          })),
        })
      })
      return tx
    }

    return [...make('loan', active), ...make('return', returned)].sort((a, b) =>
      b.date.localeCompare(a.date)
    )
  }

  const currentReceiptTenant = () => {
    const t = lease.tenants?.[0]
    return t
      ? toReceiptTenant(t)
      : { id: '', personnummer: '', firstName: 'Okänd', lastName: 'Hyresgäst' }
  }

  const handleReprint = (receipt: Receipt) => {
    const tenant = currentReceiptTenant()
    const keys: Key[] = [] // mock: not tracking actual keys yet
    if (receipt.receiptType === 'loan') {
      generateLoanReceipt({ lease, tenant, keys, receiptType: 'loan' })
    } else {
      generateReturnReceipt({ lease, tenant, keys, receiptType: 'return' })
    }
  }

  const handleGenerateFromTx = (tx: LoanTransaction) => {
    const tenant = currentReceiptTenant()
    const receiptNumber = `${tx.type === 'loan' ? 'NYL' : 'NYÅ'}-${format(
      new Date(),
      'yyyyMMdd-HHmmss'
    )}`

    mockReceipts.create({
      receiptType: tx.type,
      leaseId: lease.leaseId,
      tenantId: tenant.id,
      keyLoanIds: tx.keyLoanIds,
      receiptNumber,
    })

    const keys: never[] = []
    if (tx.type === 'loan') {
      generateLoanReceipt({
        lease,
        tenant,
        keys,
        receiptType: 'loan',
        operationDate: new Date(tx.date),
      })
    } else {
      generateReturnReceipt({
        lease,
        tenant,
        keys,
        receiptType: 'return',
        operationDate: new Date(tx.date),
      })
    }

    // refresh
    const r = mockReceipts.listByLease(lease.leaseId)
    const { active, returned } = mockKeyLoans.listByLease(lease.leaseId)
    setReceipts(r)
    setTransactions(buildTransactions(active, returned))
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
                      {tx.keyLoanIds.length} nyckel
                      {tx.keyLoanIds.length !== 1 ? 'ar' : ''}
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
