import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Printer, AlertCircle } from 'lucide-react'

import type { ReceiptData, Lease } from '@/services/types'
import {
  fetchReceiptData,
  openPdfInNewTab,
  openMaintenanceReceiptInNewTab,
} from '@/services/receiptHandlers'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'

type TenantReceiptProps = {
  isOpen: boolean
  onClose: () => void
  receiptId: string | null
  lease: Lease
  loanType?: 'TENANT'
  loanId?: never
}

type MaintenanceReceiptProps = {
  isOpen: boolean
  onClose: () => void
  receiptId?: string | null
  lease?: never
  loanType: 'MAINTENANCE'
  loanId: string | null
}

type ReceiptDialogProps = TenantReceiptProps | MaintenanceReceiptProps

export function ReceiptDialog(props: ReceiptDialogProps) {
  const { isOpen, onClose, loanType = 'TENANT' } = props
  const isMaintenance = loanType === 'MAINTENANCE'

  const { addSignature } = useCommentWithSignature()

  // Tenant mode: fetch receipt data
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)
  const [comment, setComment] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  // Fetch receipt data when dialog opens (tenant mode only)
  useEffect(() => {
    if (isMaintenance) return

    const { receiptId, lease } = props as TenantReceiptProps

    if (!isOpen || !receiptId) {
      setReceiptData(null)
      setComment('')
      return
    }

    let cancelled = false
    const loadReceiptData = async () => {
      setIsLoadingReceipt(true)
      try {
        const data = await fetchReceiptData(receiptId, lease)
        if (!cancelled) {
          setReceiptData(data)
        }
      } catch (err) {
        console.error('Failed to fetch receipt data:', err)
      } finally {
        if (!cancelled) {
          setIsLoadingReceipt(false)
        }
      }
    }

    loadReceiptData()

    return () => {
      cancelled = true
    }
  }, [isOpen, isMaintenance, props])

  // Reset comment when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setComment('')
    }
  }, [isOpen])

  // ---------- PRINT ----------
  const handleOpenPdfTab = async () => {
    if (isMaintenance) {
      const { loanId } = props as MaintenanceReceiptProps
      if (!loanId) return
      setIsPrinting(true)
      try {
        await openMaintenanceReceiptInNewTab(loanId, addSignature(comment))
      } finally {
        setIsPrinting(false)
      }
    } else {
      if (!receiptData) return
      const { receiptId } = props as TenantReceiptProps
      const dataWithComment = { ...receiptData, comment: addSignature(comment) }
      await openPdfInNewTab(dataWithComment, receiptId ?? undefined)
    }
  }

  // ---------- TEXT ----------
  const actionText = isMaintenance
    ? 'Nycklar utlånade'
    : receiptData?.receiptType === 'LOAN'
      ? 'Nycklar utlånade'
      : 'Nycklar återlämnade'

  const signerLabel = isMaintenance ? 'entreprenören' : 'hyresgästen'

  const descriptionText = isMaintenance
    ? `En utlåningskvittens har skapats. Skriv ut och låt ${signerLabel} signera.`
    : receiptData?.receiptType === 'LOAN'
      ? `En utlåningskvittens har skapats. Skriv ut och låt ${signerLabel} signera.`
      : 'En återlämningskvittens har skapats. Du kan skriva ut den.'

  const isLoanReceipt = isMaintenance || receiptData?.receiptType === 'LOAN'

  // Don't show dialog for return receipts - they're auto-generated for records only
  if (!isMaintenance && receiptData?.receiptType === 'RETURN') {
    return null
  }

  // For maintenance mode: ready to print immediately (no data fetching needed)
  // For tenant mode: ready when receipt data is loaded
  const canPrint = isMaintenance
    ? !!(props as MaintenanceReceiptProps).loanId && !isPrinting
    : !!receiptData && !isLoadingReceipt

  const isLoading = isMaintenance ? isPrinting : isLoadingReceipt

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
          {isLoanReceipt && (
            <Alert
              variant="default"
              className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
            >
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                <strong>Signering krävs:</strong> Utlåningskvittensen ska
                signeras av {signerLabel}.
              </AlertDescription>
            </Alert>
          )}

          {/* Comment input */}
          <CommentInput
            value={comment}
            onChange={setComment}
            placeholder="Lägg till en kommentar på kvittensen..."
          />

          {/* Print (opens the real PDF and auto-opens print dialog) */}
          <Button
            onClick={handleOpenPdfTab}
            className="gap-2 w-full"
            disabled={!canPrint}
          >
            <Printer className="h-4 w-4" />
            {isLoading ? 'Laddar kvittens...' : 'Skriv ut kvittens'}
          </Button>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
