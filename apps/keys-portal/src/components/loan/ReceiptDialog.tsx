import { useState, useRef, DragEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Printer, Upload, Download, AlertCircle } from 'lucide-react'

import type { ReceiptData } from '@/services/types'
import { receiptService } from '@/services/api/receiptService'
import {
  generateLoanReceiptBlob,
  generateReturnReceiptBlob,
} from '@/lib/pdf-receipts'

export function ReceiptDialog({
  isOpen,
  onClose,
  receiptData,
  receiptId,
  enableUpload = true, // parent can hide upload UI (you use false)
}: {
  isOpen: boolean
  onClose: () => void
  receiptData: ReceiptData | null
  receiptId: string | null
  enableUpload?: boolean
}) {
  // Upload state (only used if enableUpload)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadInfo, setUploadInfo] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Download state (only used if enableUpload)
  const [isDownloading, setIsDownloading] = useState(false)

  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

  // ---------- PRINT (open the *real* jsPDF PDF in a new tab + auto print) ----------
  const handleOpenPdfTab = async () => {
    if (!receiptData) return

    // Open a placeholder tab synchronously to avoid popup blockers
    const win = window.open('', '_blank')
    if (!win) {
      // Popup blocked; you could also fall back to creating a temporary link and clicking it.
      return
    }
    win.document.write(
      '<!doctype html><title>Kvitto</title><body>Förbereder kvitto…</body>'
    )
    win.document.close()

    // Build the actual jsPDF as a Blob
    const { blob, fileName } =
      receiptData.receiptType === 'LOAN'
        ? await generateLoanReceiptBlob(receiptData, receiptId ?? undefined)
        : await generateReturnReceiptBlob(receiptData, receiptId ?? undefined)

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

  // ---------- Upload helpers (only shown if enableUpload) ----------
  function validateFile(file: File): string | null {
    if (file.type !== 'application/pdf') return 'Endast PDF-filer tillåtna.'
    if (file.size > MAX_SIZE) return 'Filen är för stor (max 10 MB).'
    return null
  }

  async function doUpload(file: File) {
    if (!receiptId) return
    setUploadError(null)
    setUploadDone(false)
    setIsUploading(true)
    try {
      await receiptService.uploadFile(receiptId, file)
      setUploadDone(true)
      setUploadInfo('Uppladdning klar!')
    } catch (e: any) {
      setUploadError(e?.message ?? 'Kunde inte ladda upp filen.')
    } finally {
      setIsUploading(false)
    }
  }

  function onFileSelected(file: File | null) {
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setUploadError(err)
      return
    }
    void doUpload(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    onFileSelected(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (isUploading) return
    const file = e.dataTransfer.files?.[0] ?? null
    onFileSelected(file)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  // ---------- Download uploaded file (only if enableUpload + upload done) ----------
  async function handleDownload() {
    if (!receiptId) return
    setIsDownloading(true)
    try {
      await receiptService.downloadFile(receiptId) // opens presigned URL in new tab
    } finally {
      setIsDownloading(false)
    }
  }

  const actionText =
    receiptData?.receiptType === 'LOAN'
      ? 'Nycklar utlånade'
      : 'Nycklar återlämnade'

  const descriptionText =
    receiptData?.receiptType === 'LOAN'
      ? enableUpload
        ? 'Ett utlåningskvitto har skapats. Skriv ut och låt hyresgästen signera, ladda sedan upp den signerade PDF:en.'
        : 'Ett utlåningskvitto har skapats. Skriv ut och låt hyresgästen signera.'
      : 'Ett återlämningskvitto har skapats. Du kan skriva ut det.'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {actionText} framgångsrikt
          </DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning about signature for LOAN receipts */}
          {receiptData?.receiptType === 'LOAN' && (
            <Alert
              variant="default"
              className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
            >
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                <strong>Signering krävs:</strong> Utlåningskvittot ska signeras
                av hyresgästen.
              </AlertDescription>
            </Alert>
          )}

          {/* Print (opens the real PDF and auto-opens print dialog) */}
          <Button
            onClick={handleOpenPdfTab}
            className="gap-2 w-full"
            disabled={!receiptData}
          >
            <Printer className="h-4 w-4" />
            Skriv ut kvitto
          </Button>

          {/* Optional upload section (hidden in your current usage) */}
          {enableUpload && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Bifoga signerad PDF</p>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer
                ${isUploading ? 'opacity-60' : 'hover:bg-muted/50'}
              `}
                onClick={() => fileInputRef.current?.click()}
                aria-disabled={isUploading}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={onInputChange}
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-5 w-5" />
                  <div className="text-xs text-muted-foreground">
                    Dra & släpp en PDF här eller klicka för att välja fil
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Max 10 MB.
                  </div>
                </div>
              </div>

              {/* Upload status */}
              <div className="min-h-[1.5rem]">
                {isUploading && (
                  <div className="text-xs">Laddar upp… {uploadInfo}</div>
                )}
                {uploadDone && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    {uploadInfo}
                  </div>
                )}
                {uploadError && (
                  <div className="text-xs text-destructive">{uploadError}</div>
                )}
              </div>

              {/* Download button once upload is done */}
              {uploadDone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  <Download className="h-4 w-4" />
                  {isDownloading ? 'Öppnar kvitto…' : 'Ladda ner uppladdad PDF'}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
