import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditKeyLoanForm } from '@/components/key-loans/EditKeyLoanForm'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'
import { useToast } from '@/hooks/use-toast'
import type { KeyLoanWithDetails, UpdateKeyLoanRequest } from '@/services/types'

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
  const { toast } = useToast()

  const handleSave = useCallback(
    async (loanData: UpdateKeyLoanRequest) => {
      try {
        await keyLoanService.update(loan.id, loanData)

        toast({
          title: 'Uppdaterat',
          description: 'Nyckellånet har uppdaterats',
        })

        onOpenChange(false)
        onSuccess()
      } catch (error) {
        console.error('Failed to update key loan:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte uppdatera nyckellånet',
          variant: 'destructive',
        })
      }
    },
    [loan.id, toast, onOpenChange, onSuccess]
  )

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleReceiptUpload = useCallback(
    async (loanId: string, file: File) => {
      try {
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

        if (!loanReceipt) {
          await receiptService.createWithFile(
            { keyLoanId: loanId, receiptType: 'LOAN', type: 'DIGITAL' },
            file
          )
        } else {
          await receiptService.uploadFile(loanReceipt.id, file)
        }

        toast({
          title: loanReceipt?.fileId
            ? 'Kvittens ersatt'
            : 'Kvittens uppladdad',
          description: loanReceipt?.fileId
            ? 'Den nya kvittensen har ersatt den gamla'
            : 'Kvittensen har laddats upp',
        })

        onSuccess()
      } catch (error) {
        console.error('Failed to upload receipt:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda upp kvittensen',
          variant: 'destructive',
        })
        throw error
      }
    },
    [toast, onSuccess]
  )

  const handleReceiptDownload = useCallback(
    async (loanId: string) => {
      try {
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

        if (loanReceipt) {
          await receiptService.downloadFile(loanReceipt.id)
        }
      } catch (error) {
        console.error('Failed to download receipt:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda ner kvittensen',
          variant: 'destructive',
        })
        throw error
      }
    },
    [toast]
  )

  const handleDelete = useCallback(
    async (loanId: string) => {
      try {
        await keyLoanService.remove(loanId)

        toast({
          title: 'Nyckellån borttaget',
          description: 'Lånet har tagits bort',
        })

        onOpenChange(false)
        onSuccess()
      } catch (error: any) {
        console.error('Failed to delete loan:', error)
        if (error?.data?.code === 'ACTIVE_LOAN_CANNOT_DELETE') {
          toast({
            title: 'Kan inte ta bort aktivt lån',
            description: 'Lånet kan inte tas bort medan nycklar är uthyrda.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Kunde inte ta bort lånet',
            description: 'Ett fel uppstod när lånet skulle tas bort',
            variant: 'destructive',
          })
        }
      }
    },
    [toast, onOpenChange, onSuccess]
  )

  const handleReceiptDelete = useCallback(
    async (loanId: string) => {
      try {
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

        if (loanReceipt) {
          await receiptService.remove(loanReceipt.id)
          await keyLoanService.update(loanId, { pickedUpAt: null })

          toast({
            title: 'Kvittens borttagen',
            description:
              'Kvittensen har tagits bort och lånet är nu markerat som ej upphämtat',
          })

          onSuccess()
        }
      } catch (error) {
        console.error('Failed to delete receipt:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ta bort kvittensen',
          variant: 'destructive',
        })
        throw error
      }
    },
    [toast, onSuccess]
  )

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
          onSave={handleSave}
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
