import { useEffect, useState, useRef } from 'react'
import { KeyRound, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type {
  Lease,
  KeyLoan,
  Key,
  Receipt,
  ReceiptData,
} from '@/services/types'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { receiptService } from '@/services/api/receiptService'
import {
  generateLoanReceiptBlob,
  generateReturnReceiptBlob,
} from '@/lib/pdf-receipts'
import { KeyLoanCard } from './KeyLoanCard'

interface KeyLoansAccordionProps {
  lease: Lease
  refreshKey?: number
  onUnsignedLoansChange?: (hasUnsignedLoans: boolean) => void
}

interface KeyLoanWithDetails {
  keyLoan: KeyLoan
  keys: Key[]
  receipts: Receipt[]
  loanReceipt?: Receipt
  returnReceipt?: Receipt
}

export function KeyLoansAccordion({
  lease,
  refreshKey,
  onUnsignedLoansChange,
}: KeyLoansAccordionProps) {
  const [keyLoans, setKeyLoans] = useState<KeyLoanWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(
    null
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showReturnedLoans, setShowReturnedLoans] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadReceiptIdRef = useRef<string | null>(null)

  const fetchKeyLoans = async () => {
    setLoading(true)
    try {
      const { loaned, returned } = await keyLoanService.listByLease(
        lease.rentalPropertyId
      )
      const allKeyLoans = [...loaned, ...returned]

      const enriched: KeyLoanWithDetails[] = []
      for (const keyLoan of allKeyLoans) {
        try {
          const keyIds: string[] = JSON.parse(keyLoan.keys || '[]')

          const keys: Key[] = []
          for (const keyId of keyIds) {
            try {
              const key = await keyService.getKey(keyId)
              keys.push(key)
            } catch (err) {
              console.error(`Failed to fetch key ${keyId}:`, err)
            }
          }

          const receipts = await receiptService.getByKeyLoan(keyLoan.id)
          const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
          const returnReceipt = receipts.find((r) => r.receiptType === 'RETURN')

          enriched.push({
            keyLoan,
            keys,
            receipts,
            loanReceipt,
            returnReceipt,
          })
        } catch (err) {
          console.error(`Failed to enrich key loan ${keyLoan.id}:`, err)
        }
      }

      // Auto-create receipts for active loans that don't have one
      for (const loanWithDetails of enriched) {
        if (
          !loanWithDetails.keyLoan.returnedAt &&
          !loanWithDetails.loanReceipt
        ) {
          try {
            console.log(
              'Auto-creating missing receipt for loan:',
              loanWithDetails.keyLoan.id
            )
            const receipt = await receiptService.create({
              keyLoanId: loanWithDetails.keyLoan.id,
              receiptType: 'LOAN',
              type: 'PHYSICAL',
            })
            loanWithDetails.loanReceipt = receipt
            loanWithDetails.receipts.push(receipt)
          } catch (err) {
            console.error(
              'Failed to auto-create receipt for loan:',
              loanWithDetails.keyLoan.id,
              err
            )
          }
        }
      }

      // Sort: unsigned active loans first, then signed active loans, then returned loans
      enriched.sort((a, b) => {
        const aIsActive = !a.keyLoan.returnedAt
        const bIsActive = !b.keyLoan.returnedAt
        const aIsUnsigned = a.loanReceipt && !a.loanReceipt.fileId
        const bIsUnsigned = b.loanReceipt && !b.loanReceipt.fileId

        if (aIsActive !== bIsActive) {
          return aIsActive ? -1 : 1
        }

        if (aIsActive && bIsActive && aIsUnsigned !== bIsUnsigned) {
          return aIsUnsigned ? -1 : 1
        }

        const aDate = a.keyLoan.createdAt
          ? new Date(a.keyLoan.createdAt).getTime()
          : 0
        const bDate = b.keyLoan.createdAt
          ? new Date(b.keyLoan.createdAt).getTime()
          : 0
        return bDate - aDate
      })

      setKeyLoans(enriched)

      // Notify parent if there are any unsigned active loans
      const hasUnsignedActiveLoans = enriched.some(
        (loan) =>
          !loan.keyLoan.returnedAt &&
          loan.loanReceipt &&
          !loan.loanReceipt.fileId
      )
      onUnsignedLoansChange?.(hasUnsignedActiveLoans)
    } catch (err) {
      console.error('Failed to fetch key loans:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeyLoans()
  }, [lease.leaseId, refreshKey])

  // Helper function to open PDF directly in new tab with print dialog
  const openPdfInNewTab = async (
    receiptData: ReceiptData,
    receiptId?: string
  ) => {
    // Open a placeholder tab synchronously to avoid popup blockers
    const win = window.open('', '_blank')
    if (!win) {
      console.error('Popup blocked')
      return
    }
    win.document.write(
      '<!doctype html><title>Kvitto</title><body>Förbereder kvitto…</body>'
    )
    win.document.close()

    // Build the actual jsPDF as a Blob
    const { blob, fileName } =
      receiptData.receiptType === 'LOAN'
        ? await generateLoanReceiptBlob(receiptData, receiptId)
        : await generateReturnReceiptBlob(receiptData, receiptId)

    const pdfUrl = URL.createObjectURL(blob)

    // Create a tiny HTML viewer that embeds the PDF and triggers print
    const viewerHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>html,body,iframe{margin:0;padding:0;height:100%;width:100%;border:0}</style>
</head>
<body>
  <iframe id="pdf" src="${pdfUrl}#view=FitH" allow="clipboard-write"></iframe>
  <script>
    const iframe = document.getElementById('pdf');
    // Try printing shortly after load; some viewers need a delay
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try { iframe.contentWindow && iframe.contentWindow.print && iframe.contentWindow.print(); } catch (e) {}
      }, 400);
    });
  </script>
</body>
</html>`

    const viewerBlob = new Blob([viewerHtml], { type: 'text/html' })
    const viewerUrl = URL.createObjectURL(viewerBlob)

    // Navigate the already-open tab to the viewer
    win.location.href = viewerUrl

    // Cleanup after a while (tab holds the URLs while open)
    setTimeout(
      () => {
        URL.revokeObjectURL(pdfUrl)
        URL.revokeObjectURL(viewerUrl)
      },
      5 * 60 * 1000
    )
  }

  const handleGenerateLoanReceipt = async (
    loanWithDetails: KeyLoanWithDetails
  ) => {
    // If a signed receipt exists (has fileId), download it from MinIO
    if (loanWithDetails.loanReceipt && loanWithDetails.loanReceipt.fileId) {
      try {
        await receiptService.downloadFile(loanWithDetails.loanReceipt.id)
        return
      } catch (err) {
        console.error('Failed to download signed receipt:', err)
        // Fall through to generate PDF if download fails
      }
    }

    // Otherwise, generate the receipt PDF client-side
    const baseReceiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys: loanWithDetails.keys,
      receiptType: 'LOAN',
      operationDate: loanWithDetails.keyLoan.createdAt
        ? new Date(loanWithDetails.keyLoan.createdAt)
        : new Date(),
    }

    if (!loanWithDetails.loanReceipt) {
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanWithDetails.keyLoan.id,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })

        await fetchKeyLoans()

        // Open PDF directly in new tab
        await openPdfInNewTab(baseReceiptData, receipt.id)
      } catch (err) {
        console.error('Failed to create loan receipt:', err)
      }
    } else {
      // Open PDF directly in new tab
      await openPdfInNewTab(baseReceiptData, loanWithDetails.loanReceipt.id)
    }
  }

  const handleGenerateReturnReceipt = async (
    loanWithDetails: KeyLoanWithDetails
  ) => {
    // If a signed receipt exists (has fileId), download it from MinIO
    if (loanWithDetails.returnReceipt && loanWithDetails.returnReceipt.fileId) {
      try {
        await receiptService.downloadFile(loanWithDetails.returnReceipt.id)
        return
      } catch (err) {
        console.error('Failed to download signed return receipt:', err)
        // Fall through to generate PDF if download fails
      }
    }

    // Otherwise, generate the receipt PDF client-side
    const baseReceiptData: ReceiptData = {
      lease,
      tenants: lease.tenants ?? [],
      keys: loanWithDetails.keys,
      receiptType: 'RETURN',
      operationDate: loanWithDetails.keyLoan.returnedAt
        ? new Date(loanWithDetails.keyLoan.returnedAt)
        : new Date(),
    }

    if (!loanWithDetails.returnReceipt) {
      try {
        const receipt = await receiptService.create({
          keyLoanId: loanWithDetails.keyLoan.id,
          receiptType: 'RETURN',
          type: 'PHYSICAL',
        })

        await fetchKeyLoans()

        // Open PDF directly in new tab
        await openPdfInNewTab(baseReceiptData, receipt.id)
      } catch (err) {
        console.error('Failed to create return receipt:', err)
      }
    } else {
      // Open PDF directly in new tab
      await openPdfInNewTab(baseReceiptData, loanWithDetails.returnReceipt.id)
    }
  }

  const handleDownloadReceipt = async (receipt: Receipt) => {
    try {
      await receiptService.downloadFile(receipt.id)
    } catch (err) {
      console.error('Failed to download receipt:', err)
    }
  }

  const handleUploadReceipt = async (receiptId: string, file: File) => {
    setUploadError(null)
    setUploadingReceiptId(receiptId)
    try {
      if (file.type !== 'application/pdf') {
        setUploadError('Endast PDF-filer är tillåtna')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Filen är för stor (max 10 MB)')
        return
      }

      await receiptService.uploadFile(receiptId, file)
      await fetchKeyLoans()
    } catch (err: any) {
      setUploadError(err?.message ?? 'Kunde inte ladda upp filen')
    } finally {
      setUploadingReceiptId(null)
    }
  }

  const onPickFile = (receiptId: string) => {
    pendingUploadReceiptIdRef.current = receiptId
    fileInputRef.current?.click()
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    const receiptId = pendingUploadReceiptIdRef.current
    if (file && receiptId) {
      void handleUploadReceipt(receiptId, file)
    }
    pendingUploadReceiptIdRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Laddar nyckellån...
      </div>
    )
  }

  if (keyLoans.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <KeyRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Inga nyckellån hittades</p>
      </div>
    )
  }

  // Separate active and returned loans
  const activeLoans = keyLoans.filter(
    (loan) => !loan.keyLoan.returnedAt
  )
  const returnedLoans = keyLoans.filter(
    (loan) => loan.keyLoan.returnedAt
  )

  return (
    <>
      <div className="space-y-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileInputChange}
        />

        {/* Active loans - always visible */}
        {activeLoans.length > 0 && (
          <div className="space-y-2">
            {activeLoans.map((loanWithDetails) => {
              const hasUnsignedLoanReceipt =
                loanWithDetails.loanReceipt && !loanWithDetails.loanReceipt.fileId
              const isActive = !loanWithDetails.keyLoan.returnedAt

              return (
                <KeyLoanCard
                  key={loanWithDetails.keyLoan.id}
                  keyLoan={loanWithDetails.keyLoan}
                  keys={loanWithDetails.keys}
                  receipts={loanWithDetails.receipts}
                  loanReceipt={loanWithDetails.loanReceipt}
                  returnReceipt={loanWithDetails.returnReceipt}
                  isActive={isActive}
                  hasUnsignedLoanReceipt={hasUnsignedLoanReceipt}
                  uploadingReceiptId={uploadingReceiptId}
                  uploadError={uploadError}
                  onGenerateLoanReceipt={() =>
                    handleGenerateLoanReceipt(loanWithDetails)
                  }
                  onGenerateReturnReceipt={() =>
                    handleGenerateReturnReceipt(loanWithDetails)
                  }
                  onUploadReceipt={onPickFile}
                  onDownloadReceipt={handleDownloadReceipt}
                />
              )
            })}
          </div>
        )}

        {/* No active loans message */}
        {activeLoans.length === 0 && returnedLoans.length > 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>Inga aktiva nyckellån</p>
          </div>
        )}

        {/* Returned loans - collapsible section */}
        {returnedLoans.length > 0 && (
          <div className="mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReturnedLoans((v) => !v)}
              className="w-full h-8 text-xs gap-2"
            >
              {showReturnedLoans ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Dölj återlämnade lån ({returnedLoans.length})
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Visa återlämnade lån ({returnedLoans.length})
                </>
              )}
            </Button>

            {showReturnedLoans && (
              <div className="space-y-2 mt-2">
                {returnedLoans.map((loanWithDetails) => {
                  const hasUnsignedLoanReceipt =
                    loanWithDetails.loanReceipt &&
                    !loanWithDetails.loanReceipt.fileId
                  const isActive = !loanWithDetails.keyLoan.returnedAt

                  return (
                    <KeyLoanCard
                      key={loanWithDetails.keyLoan.id}
                      keyLoan={loanWithDetails.keyLoan}
                      keys={loanWithDetails.keys}
                      receipts={loanWithDetails.receipts}
                      loanReceipt={loanWithDetails.loanReceipt}
                      returnReceipt={loanWithDetails.returnReceipt}
                      isActive={isActive}
                      hasUnsignedLoanReceipt={hasUnsignedLoanReceipt}
                      uploadingReceiptId={uploadingReceiptId}
                      uploadError={uploadError}
                      onGenerateLoanReceipt={() =>
                        handleGenerateLoanReceipt(loanWithDetails)
                      }
                      onGenerateReturnReceipt={() =>
                        handleGenerateReturnReceipt(loanWithDetails)
                      }
                      onUploadReceipt={onPickFile}
                      onDownloadReceipt={handleDownloadReceipt}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
