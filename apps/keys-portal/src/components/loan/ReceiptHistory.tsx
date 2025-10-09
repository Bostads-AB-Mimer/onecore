import { useEffect, useRef, useState, DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Printer,
  Calendar,
  ChevronDown,
  Plus,
  Upload,
  Download,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type {
  Lease,
  Receipt,
  KeyLoan,
  Key,
  Tenant,
  ReceiptData,
} from '@/services/types'
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

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function ReceiptHistory({ lease }: { lease: Lease }) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [transactions, setTransactions] = useState<LoanTransaction[]>([])
  const [loading, setLoading] = useState(true)

  // Upload/download UI state
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // single hidden input reused per-row uploads
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadReceiptIdRef = useRef<string | null>(null)

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
    const existingIds = new Set(existingReceipts.map((r) => r.keyLoanId))

    const parseKeysCsv = (csv?: string): string[] =>
      String(csv ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

    const groupByDay = (
      items: KeyLoan[],
      kind: 'loan' | 'return'
    ): LoanTransaction[] => {
      const usable = items.filter((l) => !existingIds.has(l.id))
      if (!usable.length) return []

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
        const keyIds = arr.flatMap((kl) => parseKeysCsv((kl as any).keys))
        tx.push({
          id: `${kind}-${leaseId}-${arr[0].id}`,
          type: kind,
          date: dateIso!,
          keyLoanIds: arr.map((x) => x.id),
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

  const currentReceiptTenants = (): Tenant[] => lease.tenants ?? []

  const handleReprint = (receipt: Receipt) => {
    const tenants = currentReceiptTenants()
    const keys: Key[] = []
    if (receipt.receiptType === 'LOAN') {
      generateLoanReceipt({ lease, tenants, keys, receiptType: 'LOAN' })
    } else {
      generateReturnReceipt({ lease, tenants, keys, receiptType: 'RETURN' })
    }
  }

  const handleGenerateFromTx = async (tx: LoanTransaction) => {
    const tenants = currentReceiptTenants()
    await Promise.all(
      tx.keyLoanIds.map((keyLoanId) =>
        receiptService.create({
          keyLoanId,
          receiptType: tx.type === 'loan' ? 'LOAN' : 'RETURN',
          type: 'PHYSICAL',
          signed: false,
        })
      )
    )
    const keys: Key[] = []
    if (tx.type === 'loan') {
      generateLoanReceipt({
        lease,
        tenants,
        keys,
        receiptType: 'LOAN',
        operationDate: new Date(tx.date),
      })
    } else {
      generateReturnReceipt({
        lease,
        tenants,
        keys,
        receiptType: 'RETURN',
        operationDate: new Date(tx.date),
      })
    }
    const [r, keyLoans] = await Promise.all([
      receiptService.listByLease(lease.leaseId),
      keyLoanService.listByLease(lease.leaseId),
    ])
    setReceipts(r)
    setTransactions(
      buildTransactions(keyLoans.loaned, keyLoans.returned, r, lease.leaseId)
    )
  }

  // ---- Per-row upload/download helpers ----
  function validateFile(file: File): string | null {
    if (file.type !== 'application/pdf') return 'Endast PDF-filer tillåtna.'
    if (file.size > MAX_SIZE) return 'Filen är för stor (max 10 MB).'
    return null
  }

  async function uploadForReceipt(receiptId: string, file: File) {
    setErrorMsg(null)
    setUploadingId(receiptId)
    try {
      const err = validateFile(file)
      if (err) throw new Error(err)
      await receiptService.uploadFile(receiptId, file)
      // refresh list to reflect fileId
      const r = await receiptService.listByLease(lease.leaseId)
      setReceipts(r)
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Kunde inte ladda upp filen.')
    } finally {
      setUploadingId(null)
    }
  }

  async function downloadForReceipt(receiptId: string) {
    setDownloadingId(receiptId)
    try {
      await receiptService.downloadFile(receiptId) // opens new tab with presigned URL
    } finally {
      setDownloadingId(null)
    }
  }

  function onPickFile(receiptId: string) {
    pendingUploadReceiptIdRef.current = receiptId
    fileInputRef.current?.click()
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    const receiptId = pendingUploadReceiptIdRef.current
    if (file && receiptId) {
      void uploadForReceipt(receiptId, file)
    }
    // reset
    pendingUploadReceiptIdRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onRowDrop(e: DragEvent<HTMLDivElement>, receiptId: string) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0] ?? null
    if (file) void uploadForReceipt(receiptId, file)
  }
  function onRowDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  if (loading)
    return (
      <div className="text-sm text-muted-foreground p-2">Laddar kvitton...</div>
    )
  if (receipts.length === 0 && transactions.length === 0) return null

  const total = receipts.length + transactions.length

  return (
    <Collapsible defaultOpen={false} className="w-full">
      {/* hidden file input used by “Välj PDF” buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileInputChange}
      />

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

            {errorMsg && (
              <div className="text-xs text-destructive">{errorMsg}</div>
            )}

            {receipts.map((r) => {
              const hasFile = Boolean(r.fileId)
              const isUploading = uploadingId === r.id
              const isDownloading = downloadingId === r.id

              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    hasFile ? 'bg-muted/30' : 'border-dashed'
                  }`}
                  // Allow drag-and-drop to upload when missing a file
                  onDrop={(e) => !hasFile && onRowDrop(e, r.id)}
                  onDragOver={(e) => !hasFile && onRowDragOver(e)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">
                        {'receiptNumber' in r && (r as any).receiptNumber
                          ? (r as any).receiptNumber
                          : r.id}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(
                          new Date(r.createdAt),
                          "d MMM yyyy 'kl.' HH:mm",
                          {
                            locale: sv,
                          }
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={
                        r.receiptType === 'LOAN' ? 'default' : 'secondary'
                      }
                    >
                      {r.receiptType === 'LOAN' ? 'Utlåning' : 'Återlämning'}
                    </Badge>

                    {hasFile ? (
                      <Badge variant="secondary">PDF bifogad</Badge>
                    ) : (
                      <Badge variant="outline" className="border-dashed">
                        Ingen PDF
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReprint(r)}
                      className="gap-2"
                    >
                      <Printer className="h-3 w-3" />
                      Skriv om
                    </Button>

                    {hasFile ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => downloadForReceipt(r.id)}
                        disabled={isDownloading}
                        className="gap-2"
                      >
                        <Download className="h-3 w-3" />
                        {isDownloading ? 'Öppnar…' : 'Ladda ner PDF'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPickFile(r.id)}
                        disabled={isUploading}
                        className="gap-2 border-dashed"
                        title="Dra & släpp PDF på raden eller klicka för att välja fil"
                      >
                        <Upload className="h-3 w-3" />
                        {isUploading ? 'Laddar upp…' : 'Välj PDF'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
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
