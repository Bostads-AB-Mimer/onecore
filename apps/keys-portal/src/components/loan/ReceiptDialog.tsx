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
import { openPdfInNewTab } from '@/lib/receiptPdfUtils'
import { fetchReceiptData } from '@/services/receiptHandlers'

export function ReceiptDialog({
  isOpen,
  onClose,
  receiptId,
  lease,
}: {
  isOpen: boolean
  onClose: () => void
  receiptId: string | null
  lease: Lease
}) {
  // Fetch receipt data when dialog opens
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)

  // Fetch receipt data when dialog opens or receiptId changes
  useEffect(() => {
    if (!isOpen || !receiptId) {
      setReceiptData(null)
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
  }, [isOpen, receiptId, lease])

  // ---------- PRINT (open the PDF in a new tab with auto print) ----------
  const handleOpenPdfTab = async () => {
    if (!receiptData) return
    await openPdfInNewTab(receiptData, receiptId ?? undefined)
  }

  const actionText =
    receiptData?.receiptType === 'LOAN'
      ? 'Nycklar utlånade'
      : 'Nycklar återlämnade'

  const descriptionText =
    receiptData?.receiptType === 'LOAN'
      ? 'Ett utlåningskvitto har skapats. Skriv ut och låt hyresgästen signera.'
      : 'Ett återlämningskvitto har skapats. Du kan skriva ut det.'

  // Don't show dialog for return receipts - they're auto-generated for records only
  if (receiptData?.receiptType === 'RETURN') {
    return null
  }

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
            disabled={!receiptData || isLoadingReceipt}
          >
            <Printer className="h-4 w-4" />
            {isLoadingReceipt ? 'Laddar kvitto...' : 'Skriv ut kvitto'}
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
