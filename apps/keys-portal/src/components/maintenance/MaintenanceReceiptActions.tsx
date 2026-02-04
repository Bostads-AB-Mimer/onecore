import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Upload, Eye } from 'lucide-react'
import { receiptService } from '@/services/api/receiptService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { useToast } from '@/hooks/use-toast'
import type { MaintenanceReceiptData, Key } from '@/services/types'
import { generateMaintenanceLoanReceiptBlob } from '@/lib/pdf-receipts'

type Props = {
  loanId: string
  onRefresh?: () => void
}

export function MaintenanceReceiptActions({ loanId, onRefresh }: Props) {
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
   * Fetch receipt data for PDF generation
   */
  const fetchReceiptData = async (): Promise<MaintenanceReceiptData> => {
    const loan = await keyLoanService.get(loanId)

    let keyIds: string[] = []
    try {
      keyIds = JSON.parse(loan.keys)
    } catch (error) {
      console.error('Failed to parse keys from maintenance loan:', error)
      throw new Error('Invalid keys data in maintenance loan')
    }

    const keysArray: Key[] = await Promise.all(
      keyIds.map((keyId) => keyService.getKey(keyId))
    )

    return {
      contact: loan.contact || 'Unknown',
      contactPerson: loan.contactPerson,
      description: loan.description,
      keys: keysArray,
      receiptType: loan.returnedAt ? 'RETURN' : 'LOAN',
      operationDate: loan.returnedAt ? new Date(loan.returnedAt) : new Date(),
    }
  }

  /**
   * Handles generating or downloading a loan receipt
   * If signed receipt exists (has fileId), downloads from MinIO
   * Otherwise, generates PDF client-side and opens in new tab
   */
  const handlePrintLoanReceipt = async () => {
    setLoading(true)
    try {
      // If a signed receipt exists (has fileId), download it from MinIO
      if (loanReceipt && loanReceipt.fileId) {
        await receiptService.downloadFile(loanReceipt.id)
        return
      }

      // Otherwise, generate the receipt PDF client-side
      const receiptData = await fetchReceiptData()

      let receiptId = loanReceipt?.id
      if (!receiptId) {
        // Create receipt record if it doesn't exist
        const newReceipt = await receiptService.create({
          keyLoanId: loanId,
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })
        receiptId = newReceipt.id

        // Refresh receipt state
        const receipts = await receiptService.getByKeyLoan(loanId)
        setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
      }

      // Generate PDF blob and open in new tab with print dialog
      const { blob } = await generateMaintenanceLoanReceiptBlob(
        receiptData,
        receiptId
      )

      const pdfUrl = URL.createObjectURL(blob)
      const win = window.open(pdfUrl, '_blank')
      if (win) {
        // Trigger print after a short delay
        setTimeout(() => {
          try {
            win.print()
          } catch (e) {
            console.error('Failed to trigger print:', e)
          }
        }, 400)

        // Cleanup URL after 5 minutes
        setTimeout(
          () => {
            URL.revokeObjectURL(pdfUrl)
          },
          5 * 60 * 1000
        )
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
            Skriv ut
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
            Lån
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
            Retur
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
