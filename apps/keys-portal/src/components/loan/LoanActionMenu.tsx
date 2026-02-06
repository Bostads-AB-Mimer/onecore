import { useState, useEffect, useRef, useMemo } from 'react'
import { Printer, Upload, Eye, ExternalLink, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import { receiptService } from '@/services/api/receiptService'
import { fetchReceiptData, openPdfInNewTab } from '@/services/receiptHandlers'
import { useToast } from '@/hooks/use-toast'
import type { KeyLoan, Lease } from '@/services/types'

export interface LoanActionMenuProps {
  loan: KeyLoan
  lease: Lease
  onRefresh?: () => void
  onReturn?: (keyIds: string[], cardIds: string[]) => void
}

export function LoanActionMenu({
  loan,
  lease,
  onRefresh,
  onReturn,
}: LoanActionMenuProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(false)
  const [loanReceipt, setLoanReceipt] = useState<{
    id: string
    fileId?: string
  } | null>(null)
  const [returnReceipt, setReturnReceipt] = useState<{
    id: string
    fileId?: string
  } | null>(null)

  // Check if loan can be returned (not already returned)
  const canReturn = !loan.returnedAt

  // Parse key and card IDs from the loan
  const { keyIds, cardIds } = useMemo(() => {
    let keyIds: string[] = []
    let cardIds: string[] = []
    try {
      keyIds = JSON.parse(loan.keys || '[]')
    } catch {
      keyIds = loan.keys ? loan.keys.split(',').map((id) => id.trim()) : []
    }
    try {
      cardIds = JSON.parse(loan.keyCards || '[]')
    } catch {
      cardIds = []
    }
    return { keyIds, cardIds }
  }, [loan.keys, loan.keyCards])

  const handleReturn = () => {
    if (onReturn && canReturn) {
      onReturn(keyIds, cardIds)
    }
  }

  // Load receipt info on mount
  useEffect(() => {
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
  }, [loan.id])

  const handlePrintLoanReceipt = async () => {
    setLoading(true)
    try {
      if (loanReceipt?.fileId) {
        await receiptService.downloadFile(loanReceipt.id)
      } else {
        const receiptId = loanReceipt?.id
        const receiptData = await fetchReceiptData(receiptId || loan.id, lease)
        await openPdfInNewTab(receiptData, receiptId)
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
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fel',
        description: 'Filen är för stor (max 10 MB)',
        variant: 'destructive',
      })
      return
    }

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

  const editLoanUrl = `/key-loans?editLoanId=${loan.id}`

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

      <ActionMenu
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
              disabled={loading || !canReturn || !onReturn}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Återlämna
            </DropdownMenuItem>

            {/* Edit loan */}
            <DropdownMenuItem asChild>
              <Link to={editLoanUrl}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Redigera lån
              </Link>
            </DropdownMenuItem>
          </>
        }
      />
    </>
  )
}
