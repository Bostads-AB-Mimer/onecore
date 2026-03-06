import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditKeyLoanForm } from '@/components/key-loans/EditKeyLoanForm'
import { useEditKeyLoanHandlers } from '@/hooks/useEditKeyLoanHandlers'
import type { KeyLoanWithDetails } from '@/services/types'

interface EditKeyLoanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: KeyLoanWithDetails
  onSuccess: () => void
}

export function EditKeyLoanDialog({
  open,
  onOpenChange,
  loan,
  onSuccess,
}: EditKeyLoanDialogProps) {
  const {
    handleSave,
    handleReceiptUpload,
    handleReceiptDownload,
    handleReceiptDelete,
    handleDelete,
  } = useEditKeyLoanHandlers({
    onSuccess,
    onClose: () => onOpenChange(false),
  })

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera nyckellån</DialogTitle>
          <DialogDescription>
            Redigera information för detta nyckellån
          </DialogDescription>
        </DialogHeader>
        <EditKeyLoanForm
          hideCard
          editingKeyLoan={loan}
          onSave={(data) => handleSave(loan.id, data)}
          onCancel={handleCancel}
          onReceiptUpload={handleReceiptUpload}
          onReceiptDownload={handleReceiptDownload}
          onReceiptDelete={handleReceiptDelete}
          onDelete={handleDelete}
        />
      </DialogContent>
    </Dialog>
  )
}
