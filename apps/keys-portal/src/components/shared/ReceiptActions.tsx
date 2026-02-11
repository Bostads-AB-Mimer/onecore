import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Upload, Eye } from 'lucide-react'
import { receiptService } from '@/services/api/receiptService'
import {
  fetchReceiptData,
  openPdfInNewTab,
  openMaintenanceReceiptInNewTab,
} from '@/services/receiptHandlers'
import { useToast } from '@/hooks/use-toast'
import type { Lease } from '@/services/types'

type Props = {
  loanId: string
  loanType: 'TENANT' | 'MAINTENANCE'
  lease?: Lease // Required for TENANT
  onRefresh?: () => void
}

export function ReceiptActions({ loanId, loanType, lease, onRefresh }: Props) {
  const [loading, setLoading] = useState(false)
  const [loanReceipt, setLoanReceipt] = useState<any>(null)
  const [returnReceipt, setReturnReceipt] = useState<any>(null)
  const [loadingReceipts, setLoadingReceipts] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load receipt info on mount
  useEffect(() => {
    const loadReceipts = async () => {
      try {
        const receipts = await receiptService.getByKeyLoan(loanId)
        setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
        setReturnReceipt(
          receipts.find((r) => r.receiptType === 'RETURN') || null
        )
      } catch (error) {
        console.error('Failed to load receipts:', error)
      } finally {
        setLoadingReceipts(false)
      }
    }
    loadReceipts()
  }, [loanId])

  /**
   * Handles generating or downloading a loan receipt
   * If signed receipt exists (has fileId), downloads from MinIO
   * Otherwise, generates PDF client-side and opens in new tab (tenant only)
   */
  const handlePrintLoanReceipt = async () => {
    setLoading(true)
    try {
      // If a signed receipt exists (has fileId), download it from MinIO
      if (loanReceipt && loanReceipt.fileId) {
        await receiptService.downloadFile(loanReceipt.id)
        return
      }

      // For tenant loans: generate PDF client-side
      if (loanType === 'TENANT' && lease) {
        const receiptId = loanReceipt?.id
        const receiptData = await fetchReceiptData(receiptId || loanId, lease)
        await openPdfInNewTab(receiptData, receiptId)
        return
      }

      // For maintenance loans: generate PDF client-side
      if (loanType === 'MAINTENANCE') {
        await openMaintenanceReceiptInNewTab(loanId)
        return
      }
    } catch (error) {
      console.error('Error generating receipt:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte generera kvittens',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewReturnReceipt = async () => {
    if (!returnReceipt?.fileId) return

    setLoading(true)
    try {
      await receiptService.downloadFile(returnReceipt.id)
    } catch (error) {
      console.error('Error viewing return receipt:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte öppna återlämningskvittens',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handles uploading a signed receipt file
   */
  const handleUploadReceipt = async (file: File) => {
    setUploadError(null)

    // Validate file BEFORE showing replacement warning
    if (file.type !== 'application/pdf') {
      setUploadError('Endast PDF-filer är tillåtna')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Filen är för stor (max 10 MB)')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Show warning if replacing existing file
    if (loanReceipt?.fileId) {
      const confirmed = confirm(
        'Obs! Det finns redan en uppladdad kvittens. ' +
          'Om du fortsätter kommer den befintliga kvittensen att ersättas. ' +
          'Är du säker?'
      )
      if (!confirmed) {
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
    }

    setLoading(true)
    try {
      // Create receipt with file or upload to existing receipt
      if (!loanReceipt) {
        // Create new receipt with file in single call
        await receiptService.createWithFile(
          {
            keyLoanId: loanId,
            receiptType: 'LOAN',
            type: 'DIGITAL',
          },
          file
        )
      } else {
        // Upload/replace file on existing receipt
        await receiptService.uploadFile(loanReceipt.id, file)
      }

      toast({
        title: loanReceipt?.fileId ? 'Kvittens ersatt' : 'Kvittens uppladdad',
        description: loanReceipt?.fileId
          ? 'Den nya kvittensen har ersatt den gamla'
          : 'Kvittensen har laddats upp',
      })

      // Refresh receipt info
      const receipts = await receiptService.getByKeyLoan(loanId)
      setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)

      onRefresh?.()
    } catch (err: any) {
      setUploadError(err?.message ?? 'Kunde inte ladda upp filen')
      toast({
        title: 'Fel',
        description: err?.message ?? 'Kunde inte ladda upp kvittens',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /**
   * Triggers file picker for receipt upload
   */
  const onPickFile = () => {
    fileInputRef.current?.click()
  }

  /**
   * Handles file selection from file picker
   */
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file) {
      void handleUploadReceipt(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleViewLoanReceipt = async () => {
    if (!loanReceipt?.fileId) return

    setLoading(true)
    try {
      await receiptService.downloadFile(loanReceipt.id)
    } catch (error) {
      console.error('Error viewing receipt:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte öppna utlåningskvittens',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loadingReceipts) {
    return null
  }

  // Button label - same for both loan types now that maintenance PDF is enabled
  const printButtonLabel = 'Skriv ut lån'

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileInputChange}
      />

      <div className="flex gap-1 flex-wrap items-center">
        <span className="text-xs text-muted-foreground">Kvittenser:</span>

        {/* Loan Receipt Actions */}
        {/* Show Print button only if no signed receipt exists */}
        {!loanReceipt?.fileId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintLoanReceipt}
            disabled={loading}
          >
            <Printer className="h-3 w-3 mr-1" />
            {printButtonLabel}
          </Button>
        )}

        {/* Upload Receipt Button - always show (enables replacement) */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPickFile}
          disabled={loading}
        >
          <Upload className="h-3 w-3 mr-1" />
          {loading ? 'Laddar upp...' : 'Ladda upp'}
        </Button>

        {/* View Loan Receipt Button - show if file uploaded */}
        {loanReceipt?.fileId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewLoanReceipt}
            disabled={loading}
          >
            <Eye className="h-3 w-3 mr-1" />
            Kvittens
          </Button>
        )}

        {/* Return Receipt Actions - only show if return receipt exists */}
        {returnReceipt?.fileId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewReturnReceipt}
            disabled={loading}
          >
            <Eye className="h-3 w-3 mr-1" />
            Kvitto
          </Button>
        )}
      </div>

      {uploadError && (
        <div className="text-[10px] text-red-600 dark:text-red-400 mt-1">
          {uploadError}
        </div>
      )}
    </>
  )
}
