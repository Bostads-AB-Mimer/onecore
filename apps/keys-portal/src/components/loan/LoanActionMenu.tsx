import { useState, useRef, useCallback } from 'react'
import { Printer, Upload, Eye, Pencil, RotateCcw } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import { ConfirmDialog } from '@/components/shared/dialogs/ConfirmDialog'
import { EditKeyLoanDialog } from './EditKeyLoanDialog'
import { ReceiptDialog } from './dialogs/ReceiptDialog'
import { useToast } from '@/hooks/use-toast'
import { useLoanReceipts } from '@/hooks/useLoanReceipts'
import type { KeyLoan, KeyLoanWithDetails } from '@/services/types'

export interface LoanActionMenuProps {
  loan: KeyLoan | KeyLoanWithDetails
  onRefresh?: () => void
  onReturn?: (loan: KeyLoanWithDetails) => void
  onEdit?: (loan: KeyLoanWithDetails) => void
}

export function LoanActionMenu({
  loan,
  onRefresh,
  onReturn,
  onEdit,
}: LoanActionMenuProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [hasOpened, setHasOpened] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showReplaceWarning, setShowReplaceWarning] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)

  const {
    enrichedLoan,
    loanReceipt,
    returnReceipt,
    uploadReceipt,
    validateFile,
    downloadReceipt,
  } = useLoanReceipts(loan, hasOpened, onRefresh)

  const canReturn = !loan.returnedAt

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open && !hasOpened) setHasOpened(true)
    },
    [hasOpened]
  )

  const download = async (receiptId: string, errorMsg: string) => {
    setLoading(true)
    try {
      await downloadReceipt(receiptId)
    } catch (error) {
      console.error(errorMsg, error)
      toast({ title: 'Fel', description: errorMsg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Print the loan receipt: download the signed upload if present, else open the
  // dialog to generate one to sign.
  const handlePrintLoanReceipt = async () => {
    if (loanReceipt?.fileId) {
      await download(loanReceipt.id, 'Kunde inte ladda ner kvittens')
      return
    }
    setShowReceiptDialog(true)
  }

  const doUpload = async (file: File) => {
    setLoading(true)
    try {
      await uploadReceipt(file)
    } catch {
      // Error already surfaced by the shared handler.
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateFile(file)) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (loanReceipt?.fileId) {
      setPendingFile(file)
      setShowReplaceWarning(true)
      return
    }
    await doUpload(file)
  }

  const handleConfirmReplace = async () => {
    if (pendingFile) await doUpload(pendingFile)
    setPendingFile(null)
    setShowReplaceWarning(false)
  }

  const handleCancelReplace = () => {
    setPendingFile(null)
    setShowReplaceWarning(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmDialog
        open={showReplaceWarning}
        onOpenChange={(open) => {
          if (!open) handleCancelReplace()
        }}
        title="Ersätt kvittens"
        description={
          <p>
            Det finns redan en uppladdad kvittens.
            <br />
            <br />
            <strong>
              Om du fortsätter kommer den befintliga kvittensen att ersättas.
            </strong>
          </p>
        }
        confirmLabel="Ersätt"
        onConfirm={handleConfirmReplace}
      />

      {/* Unified: prepareReceipt resolves tenant vs maintenance from the loan itself. */}
      <ReceiptDialog
        isOpen={showReceiptDialog}
        onClose={() => setShowReceiptDialog(false)}
        receiptId={loanReceipt?.id ?? null}
        loanId={loan.id}
      />

      {enrichedLoan && (
        <EditKeyLoanDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          loan={enrichedLoan}
          onSuccess={() => onRefresh?.()}
        />
      )}

      <ActionMenu
        onOpenChange={handleMenuOpenChange}
        extraItems={
          <>
            <DropdownMenuItem
              onClick={handlePrintLoanReceipt}
              disabled={loading}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut lånkvittens
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                loanReceipt &&
                download(loanReceipt.id, 'Kunde inte öppna utlåningskvittens')
              }
              disabled={loading || !loanReceipt?.fileId}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visa lånkvittens
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {loanReceipt?.fileId
                ? 'Ersätt lånkvittens'
                : 'Ladda upp lånkvittens'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() =>
                returnReceipt &&
                download(
                  returnReceipt.id,
                  'Kunde inte öppna återlämningskvittens'
                )
              }
              disabled={loading || !returnReceipt?.fileId}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visa returkvittens
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => enrichedLoan && onReturn?.(enrichedLoan)}
              disabled={loading || !canReturn || !onReturn || !enrichedLoan}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Återlämna
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                if (onEdit && enrichedLoan) onEdit(enrichedLoan)
                else setShowEditDialog(true)
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Redigera lån
            </DropdownMenuItem>
          </>
        }
      />
    </>
  )
}
