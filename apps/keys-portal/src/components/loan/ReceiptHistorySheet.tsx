import { useEffect, useState, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  Printer,
  Clock,
  Upload,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type {
  Lease,
  Receipt,
  KeyLoan,
  Key,
  ReceiptData,
} from '@/services/types'
import { receiptService } from '@/services/api/receiptService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { generateLoanReceipt, generateReturnReceipt } from '@/lib/pdf-receipts'

interface ReceiptHistorySheetProps {
  lease: Lease
}

interface PendingReceiptData {
  receipt: Receipt
  keyLoan: KeyLoan
  keys: Key[]
}

export function ReceiptHistorySheet({ lease }: ReceiptHistorySheetProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceiptData[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      // Step 1: Fetch all keyLoans for this lease
      const { loaned, returned } = await keyLoanService.listByLease(
        lease.leaseId
      )
      const allKeyLoans = [...loaned, ...returned]
      console.log(
        '📋 [ReceiptHistory] Fetched keyLoans for lease',
        lease.leaseId,
        ':',
        allKeyLoans
      )

      // Step 2: Fetch receipts for each keyLoan
      const allReceipts: Receipt[] = []
      for (const keyLoan of allKeyLoans) {
        try {
          const receiptsForLoan = await receiptService.getByKeyLoan(keyLoan.id)
          allReceipts.push(...receiptsForLoan)
        } catch (err) {
          console.error(
            `Failed to fetch receipts for keyLoan ${keyLoan.id}:`,
            err
          )
        }
      }
      console.log('📋 [ReceiptHistory] Total receipts fetched:', allReceipts)

      // Filter signed vs pending
      const signed = allReceipts.filter((r) => r.signed && r.fileId)
      const pending = allReceipts.filter((r) => !r.signed && !r.fileId)

      console.log('✅ [ReceiptHistory] Signed receipts:', signed)
      console.log('⏳ [ReceiptHistory] Pending receipts:', pending)

      // For pending receipts, fetch keyLoan and key details
      const enrichedPending: PendingReceiptData[] = []
      for (const receipt of pending) {
        try {
          const keyLoan = await keyLoanService.get(receipt.keyLoanId)
          const keyIds: string[] = JSON.parse(keyLoan.keys)

          // Fetch all keys
          const keys: Key[] = []
          for (const keyId of keyIds) {
            try {
              const key = await keyService.getKey(keyId)
              keys.push(key)
            } catch (err) {
              console.error(`Failed to fetch key ${keyId}:`, err)
            }
          }

          enrichedPending.push({ receipt, keyLoan, keys })
        } catch (err) {
          console.error(`Failed to fetch keyLoan ${receipt.keyLoanId}:`, err)
        }
      }

      setReceipts(signed)
      setPendingReceipts(enrichedPending)
    } catch (err) {
      console.error('Failed to fetch receipts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      await fetchData()
    }

    if (!cancelled) {
      fetch()
    }

    return () => {
      cancelled = true
    }
  }, [lease.leaseId])

  // Filter signed receipts by type
  const loanReceipts = receipts.filter((r) => r.receiptType === 'LOAN')
  const returnReceipts = receipts.filter((r) => r.receiptType === 'RETURN')

  const totalCount =
    loanReceipts.length + returnReceipts.length + pendingReceipts.length

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) fetchData()
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Kvittohistorik
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {totalCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[400px] sm:w-[540px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Kvittohistorik</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {lease.rentalPropertyId}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Laddar kvitton...
            </div>
          )}

          {!loading && (
            <>
              {/* PENDING Receipts Section */}
              {pendingReceipts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <h3 className="text-sm font-semibold">Väntande kvitton</h3>
                    <Badge
                      variant="outline"
                      className="ml-auto text-yellow-600 border-yellow-600"
                    >
                      {pendingReceipts.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {pendingReceipts.map(({ receipt, keyLoan, keys }) => (
                      <PendingReceiptCard
                        key={receipt.id}
                        receipt={receipt}
                        keyLoan={keyLoan}
                        keys={keys}
                        lease={lease}
                        onRefresh={fetchData}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* LOAN Receipts Section */}
              {loanReceipts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold">Utlånade nycklar</h3>
                    <Badge variant="outline" className="ml-auto">
                      {loanReceipts.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {loanReceipts.map((receipt) => (
                      <ReceiptCard key={receipt.id} receipt={receipt} />
                    ))}
                  </div>
                </div>
              )}

              {/* RETURN Receipts Section */}
              {returnReceipts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-green-600" />
                    <h3 className="text-sm font-semibold">
                      Återlämnade nycklar
                    </h3>
                    <Badge variant="outline" className="ml-auto">
                      {returnReceipts.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {returnReceipts.map((receipt) => (
                      <ReceiptCard key={receipt.id} receipt={receipt} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {loanReceipts.length === 0 &&
                returnReceipts.length === 0 &&
                pendingReceipts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Inga kvitton hittades
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kvitton visas här efter att de har skapats
                    </p>
                  </div>
                )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface PendingReceiptCardProps {
  receipt: Receipt
  keyLoan: KeyLoan
  keys: Key[]
  lease: Lease
  onRefresh: () => void
}

function PendingReceiptCard({
  receipt,
  keyLoan,
  keys,
  lease,
  onRefresh,
}: PendingReceiptCardProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (!file) return

    // Validate file
    if (file.type !== 'application/pdf') {
      setError('Endast PDF-filer är tillåtna')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Filen är för stor (max 10 MB)')
      return
    }

    setUploading(true)
    setError(null)

    try {
      await receiptService.uploadFile(receipt.id, file)
      // Refresh to move this from pending → signed
      onRefresh()
    } catch (err: any) {
      setError(err?.message ?? 'Kunde inte ladda upp filen')
    } finally {
      setUploading(false)
    }
  }

  const handleRegenerate = () => {
    // Re-download the PDF from the original receipt data
    const receiptData: ReceiptData = {
      lease,
      tenants: lease.tenants,
      keys,
      receiptType: receipt.receiptType,
      operationDate: new Date(receipt.createdAt),
    }

    if (receipt.receiptType === 'LOAN') {
      generateLoanReceipt(receiptData)
    } else {
      generateReturnReceipt(receiptData)
    }
  }

  return (
    <div className="border-2 border-yellow-200 bg-yellow-50 rounded-lg p-3 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium">
              {receipt.receiptType === 'LOAN' ? 'Utlåning' : 'Återlämning'} - Ej
              signerad
            </span>
            <Badge
              variant="outline"
              className="text-yellow-600 border-yellow-600 text-xs"
            >
              Väntande
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Skapad:{' '}
            {format(new Date(receipt.createdAt), "dd MMMM yyyy 'kl.' HH:mm", {
              locale: sv,
            })}
          </div>
        </div>
      </div>

      {/* Key list */}
      <div className="text-xs bg-yellow-100/50 rounded p-2">
        <span className="font-medium">Nycklar: </span>
        {keys.length > 0 ? (
          <span>{keys.map((k) => k.keyName).join(', ')}</span>
        ) : (
          <span className="text-muted-foreground italic">
            Inga nycklar hittades
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded p-2">
          ⚠️ {error}
        </div>
      )}

      {/* Actions */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
          // Reset input
          e.target.value = ''
        }}
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1"
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? 'Laddar upp...' : 'Ladda upp signerad PDF'}
        </Button>

        <Button size="sm" variant="ghost" onClick={handleRegenerate}>
          <Printer className="h-3 w-3 mr-1" />
          Generera igen
        </Button>
      </div>

      {/* Warning message */}
      <div className="text-xs text-muted-foreground bg-yellow-100/50 rounded p-2 border-t border-yellow-200">
        ⚠️ Nycklarna är inte officiellt utlånade förrän kvittot är signerat och
        uppladdat
      </div>
    </div>
  )
}

function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await receiptService.downloadFile(receipt.id)
    } catch (err) {
      console.error('Failed to download receipt:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {receipt.receiptType === 'LOAN' ? 'Utlåning' : 'Återlämning'}
            </span>
            {receipt.signed && (
              <Badge variant="default" className="text-xs">
                Signerad
              </Badge>
            )}
            {receipt.type === 'DIGITAL' && (
              <Badge variant="secondary" className="text-xs">
                Digital
              </Badge>
            )}
            {receipt.type === 'PHYSICAL' && (
              <Badge variant="outline" className="text-xs">
                Fysisk
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(receipt.createdAt), "dd MMMM yyyy 'kl.' HH:mm", {
              locale: sv,
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {receipt.fileId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1"
          >
            <Download className="h-3 w-3 mr-1" />
            {downloading ? 'Laddar...' : 'Ladda ner PDF'}
          </Button>
        )}
        {!receipt.fileId && (
          <div className="flex-1 text-xs text-muted-foreground italic py-2 text-center">
            Ingen fil uppladdad
          </div>
        )}
      </div>
    </div>
  )
}
