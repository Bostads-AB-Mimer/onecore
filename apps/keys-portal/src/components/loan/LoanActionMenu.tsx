import { useState, useEffect, useRef, useCallback } from 'react'
import { Printer, Upload, Eye, Pencil, RotateCcw } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import { ConfirmDialog } from '@/components/shared/dialogs/ConfirmDialog'
import { EditKeyLoanDialog } from './EditKeyLoanDialog'
import { receiptService } from '@/services/api/receiptService'
import {
  fetchReceiptData,
  openPdfInNewTab,
  openMaintenanceReceiptInNewTab,
} from '@/services/receiptHandlers'
import { keyLoanService } from '@/services/api/keyLoanService'
import { useToast } from '@/hooks/use-toast'
import type { KeyLoan, KeyLoanWithDetails, Lease } from '@/services/types'

function isEnriched(
  loan: KeyLoan | KeyLoanWithDetails
): loan is KeyLoanWithDetails {
  return 'keysArray' in loan && loan.keysArray !== undefined
}

export interface LoanActionMenuProps {
  loan: KeyLoan | KeyLoanWithDetails
  lease?: Lease
  onRefresh?: () => void
  onReturn?: (loan: KeyLoanWithDetails) => void
  onEdit?: (loan: KeyLoanWithDetails) => void
}

export function LoanActionMenu({
  loan,
  lease,
  onRefresh,
  onReturn,
  onEdit,
}: LoanActionMenuProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [enrichedLoan, setEnrichedLoan] = useState<KeyLoanWithDetails | null>(
    isEnriched(loan) ? loan : null
  )
  const [loading, setLoading] = useState(false)
  const [loanReceipt, setLoanReceipt] = useState<{
    id: string
    fileId?: string
  } | null>(null)
  const [returnReceipt, setReturnReceipt] = useState<{
    id: string
    fileId?: string
  } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showReplaceWarning, setShowReplaceWarning] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Check if loan can be returned (not already returned)
  const canReturn = !loan.returnedAt

  const handleReturn = () => {
    if (onReturn && canReturn && enrichedLoan) {
      onReturn(enrichedLoan)
    }
  }

  const [hasOpened, setHasOpened] = useState(false)

  // Sync enrichedLoan when prop changes and is already enriched
  useEffect(() => {
    if (isEnriched(loan)) {
      setEnrichedLoan(loan)
    }
  }, [loan])

  // Load receipt info and enrich loan lazily (only after menu is first opened)
  useEffect(() => {
    if (!hasOpened) return

    const loadReceipts = async () => {
      try {
        const receipts = await receiptService.getByKeyLoan(loan.id)
        setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
        setReturnReceipt(
          receipts.find((r) => r.receiptType === 'RETURN') || null
        )
      } catch (error) {
        console.error('Failed to load receipts:', error)
      }
    }
    loadReceipts()

    if (!isEnriched(loan)) {
      keyLoanService
        .get(loan.id, { includeKeySystem: true, includeCards: true })
        .then((details) => setEnrichedLoan(details as KeyLoanWithDetails))
        .catch((error) => console.error('Failed to enrich loan:', error))
    }
  }, [hasOpened, loan.id])

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open && !hasOpened) {
        setHasOpened(true)
      }
    },
    [hasOpened]
  )

  const handlePrintLoanReceipt = async () => {
    setLoading(true)
    try {
      // If there's an uploaded receipt, download it
      if (loanReceipt?.fileId) {
        await receiptService.downloadFile(loanReceipt.id)
      } else if (loan.loanType === 'MAINTENANCE') {
        // Maintenance loans have their own receipt generation
        await openMaintenanceReceiptInNewTab(loan.id)
      } else if (lease) {
        // Regular loans need lease context
        const receiptId = loanReceipt?.id
        const receiptData = await fetchReceiptData(receiptId || loan.id, lease)
        await openPdfInNewTab(receiptData, receiptId)
      } else {
        // Non-maintenance loan without lease - show error
        toast({
          title: 'Kan inte generera kvittens',
          description:
            'För att generera en lånkvittens, gå till utlåningssidan för kontraktet.',
          variant: 'destructive',
        })
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

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Fel',
        description: 'Endast PDF-filer är tillåtna',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fel',
        description: 'Filen är för stor (max 10 MB)',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (loanReceipt?.fileId) {
      setPendingFile(file)
      setShowReplaceWarning(true)
      return
    }

    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setLoading(true)
    try {
      if (!loanReceipt) {
        await receiptService.createWithFile(
          {
            keyLoanId: loan.id,
            receiptType: 'LOAN',
            type: 'DIGITAL',
          },
          file
        )
      } else {
        await receiptService.uploadFile(loanReceipt.id, file)
      }

      toast({
        title: loanReceipt?.fileId ? 'Kvittens ersatt' : 'Kvittens uppladdad',
        description: loanReceipt?.fileId
          ? 'Den nya kvittensen har ersatt den gamla'
          : 'Kvittensen har laddats upp',
      })

      // Refresh receipt info
      const receipts = await receiptService.getByKeyLoan(loan.id)
      setLoanReceipt(receipts.find((r) => r.receiptType === 'LOAN') || null)
      onRefresh?.()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Kunde inte ladda upp filen'
      toast({
        title: 'Fel',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmReplace = async () => {
    if (pendingFile) {
      await uploadFile(pendingFile)
    }
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
      {/* Hidden file input for upload */}
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
            {/* Loan receipt section */}
            <DropdownMenuItem
              onClick={handlePrintLoanReceipt}
              disabled={loading}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut lånkvittens
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleViewLoanReceipt}
              disabled={loading || !loanReceipt?.fileId}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visa lånkvittens
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleUploadClick} disabled={loading}>
              <Upload className="h-4 w-4 mr-2" />
              {loanReceipt?.fileId
                ? 'Ersätt lånkvittens'
                : 'Ladda upp lånkvittens'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Return receipt section */}
            <DropdownMenuItem
              onClick={handleViewReturnReceipt}
              disabled={loading || !returnReceipt?.fileId}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visa returkvittens
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Return keys */}
            <DropdownMenuItem
              onClick={handleReturn}
              disabled={loading || !canReturn || !onReturn || !enrichedLoan}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Återlämna
            </DropdownMenuItem>

            {/* Edit loan */}
            <DropdownMenuItem
              onClick={() => {
                if (onEdit && enrichedLoan) {
                  onEdit(enrichedLoan)
                } else {
                  setShowEditDialog(true)
                }
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
