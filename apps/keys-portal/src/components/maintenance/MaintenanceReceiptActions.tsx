import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Upload, Eye } from 'lucide-react'
import { receiptService } from '@/services/api/receiptService'
import { maintenanceKeysService } from '@/services/api/maintenanceKeysService'
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
  const [receipt, setReceipt] = useState<any>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load receipt info on mount
  useEffect(() => {
    const loadReceipt = async () => {
      try {
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
        setReceipt(loanReceipt || null)
      } catch (error) {
        console.error('Failed to load receipt:', error)
      } finally {
        setLoadingReceipt(false)
      }
    }
    loadReceipt()
  }, [loanId])

  /**
   * Fetch receipt data for PDF generation
   */
  const fetchReceiptData = async (): Promise<MaintenanceReceiptData> => {
    const loan = await maintenanceKeysService.get(loanId)

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
      company: loan.company || 'Unknown',
      contactPerson: loan.contactPerson,
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
  const handlePrintReceipt = async () => {
    setLoading(true)
    try {
      // If a signed receipt exists (has fileId), download it from MinIO
      if (receipt && receipt.fileId) {
        await receiptService.downloadFile(receipt.id)
        return
      }

      // Otherwise, generate the receipt PDF client-side
      const receiptData = await fetchReceiptData()

      let receiptId = receipt?.id
      if (!receiptId) {
        // Create receipt record if it doesn't exist
        const newReceipt = await receiptService.create({
          keyLoanId: loanId,
          loanType: 'MAINTENANCE',
          receiptType: 'LOAN',
          type: 'PHYSICAL',
        })
        receiptId = newReceipt.id

        // Refresh receipt state
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
        setReceipt(loanReceipt || null)
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

  /**
   * Handles uploading a signed receipt file
   */
  const handleUploadReceipt = async (file: File) => {
    setUploadError(null)
    setLoading(true)
    try {
      if (file.type !== 'application/pdf') {
        setUploadError('Endast PDF-filer är tillåtna')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Filen är för stor (max 10 MB)')
        return
      }

      // Create receipt record if it doesn't exist
      let receiptId = receipt?.id
      if (!receiptId) {
        const newReceipt = await receiptService.create({
          keyLoanId: loanId,
          loanType: 'MAINTENANCE',
          receiptType: 'LOAN',
          type: 'DIGITAL',
        })
        receiptId = newReceipt.id
      }

      await receiptService.uploadFile(receiptId, file)

      toast({
        title: 'Kvittens uppladdad',
        description: 'Kvittensen har laddats upp',
      })

      // Refresh receipt info
      const receipts = await receiptService.getByKeyLoan(loanId)
      const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')
      setReceipt(loanReceipt || null)

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

  const handleViewReceipt = async () => {
    if (!receipt?.fileId) return

    setLoading(true)
    try {
      await receiptService.downloadFile(receipt.id)
    } catch (error) {
      console.error('Error viewing receipt:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte öppna kvittens',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loadingReceipt) {
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

      <div className="flex gap-1">
        {/* Print Receipt Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrintReceipt}
          disabled={loading}
        >
          <Printer className="h-3 w-3 mr-1" />
          Skriv ut
        </Button>

        {/* Upload Receipt Button - show if no file uploaded */}
        {!receipt?.fileId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPickFile}
            disabled={loading}
          >
            <Upload className="h-3 w-3 mr-1" />
            {loading ? 'Laddar upp...' : 'Ladda upp'}
          </Button>
        )}

        {/* View Receipt Button - show if file uploaded */}
        {receipt?.fileId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewReceipt}
            disabled={loading}
          >
            <Eye className="h-3 w-3 mr-1" />
            Visa
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
