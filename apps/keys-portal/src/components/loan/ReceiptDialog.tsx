import { useState, useRef, DragEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Printer, Upload, Download } from 'lucide-react'

import type { ReceiptData } from '@/services/types'
import { generateLoanReceipt, generateReturnReceipt } from '@/lib/pdf-receipts'
import { receiptService } from '@/services/api/receiptService'

export function ReceiptDialog({
  isOpen,
  onClose,
  receiptData,
  receiptId,
}: {
  isOpen: boolean
  onClose: () => void
  receiptData: ReceiptData | null
  receiptId: string | null
}) {
  // Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadInfo, setUploadInfo] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Download state
  const [isDownloading, setIsDownloading] = useState(false)

  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

  // Generate and download PDF
  const handlePrintPDF = async () => {
    if (!receiptData) return

    // Generate PDF for download
    if (receiptData.receiptType === 'LOAN') {
      generateLoanReceipt(receiptData)
    } else {
      generateReturnReceipt(receiptData)
    }
  }

  // ---------- Dropzone helpers ----------
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

  // ---------- Download helper ----------
  async function handleDownload() {
    if (!receiptId) return
    setIsDownloading(true)
    try {
      // This opens the file in a new tab (uses presigned URL under the hood)
      await receiptService.downloadFile(receiptId)
    } finally {
      setIsDownloading(false)
    }
  }

  const actionText =
    receiptData?.receiptType === 'LOAN'
      ? 'Nycklar utlånade'
      : 'Nycklar återlämnade'

  const receiptText =
    receiptData?.receiptType === 'LOAN'
      ? 'utlåningskvitto'
      : 'återlämningskvitto'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {actionText} framgångsrikt
          </DialogTitle>
          <DialogDescription>
            Ett {receiptText} har skapats. Du kan skriva ut det och ladda upp en
            signerad version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Print PDF button */}
          <Button
            onClick={handlePrintPDF}
            className="gap-2 w-full"
            disabled={!receiptData}
          >
            <Printer className="h-4 w-4" />
            Skriv ut kvitto (PDF)
          </Button>

          {/* Upload section */}
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
