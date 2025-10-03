import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Printer } from 'lucide-react'

import type { ReceiptData } from '@/services/types'
import { generateLoanReceipt, generateReturnReceipt } from '@/lib/pdf-receipts'
import { receiptService } from '@/services/api/receiptService'

interface ReceiptDialogProps {
  isOpen: boolean
  onClose: () => void
  receiptData: ReceiptData | null
  keyLoanIds: string[]
}

export function ReceiptDialog({
  isOpen,
  onClose,
  receiptData,
  keyLoanIds,
}: ReceiptDialogProps) {
  const [isCreating, setIsCreating] = useState(false)

  const generateReceiptNumber = (type: 'loan' | 'return') => {
    const ts = new Date().getTime()
    return `${type === 'loan' ? 'UTLÅN' : 'ÅTERLÄMN'}-${ts}`
  }

  const handleCreateReceipt = async () => {
    if (!receiptData || keyLoanIds.length === 0) return
    setIsCreating(true)
    try {
      const receiptNumber = generateReceiptNumber(receiptData.receiptType)

      // persist on backend
      await receiptService.create({
        receiptType: receiptData.receiptType,
        leaseId: receiptData.lease.leaseId,
        tenantId: receiptData.tenants[0].id,
        keyLoanIds,
        receiptNumber,
      })

      // generate PDF
      if (receiptData.receiptType === 'loan') {
        generateLoanReceipt(receiptData)
      } else {
        generateReturnReceipt(receiptData)
      }

      onClose()
    } finally {
      setIsCreating(false)
    }
  }

  const actionText =
    receiptData?.receiptType === 'loan'
      ? 'Nycklar utlånade'
      : 'Nycklar återlämnade'
  const receiptText =
    receiptData?.receiptType === 'loan'
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
            Vill du skapa och skriva ut ett {receiptText} för denna transaktion?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Inte nu
          </Button>
          <Button
            onClick={handleCreateReceipt}
            disabled={isCreating}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            {isCreating ? 'Skapar kvitto...' : 'Skapa kvitto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
