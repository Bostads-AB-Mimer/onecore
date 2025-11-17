import { useState, useEffect } from 'react'
import type { Key } from '@/services/types'
import {
  ReturnKeysDialogBase,
  type LoanGroup,
} from '@/components/shared/dialogs/ReturnKeysDialogBase'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'
import { keyService } from '@/services/api/keyService'
import { generateMaintenanceReturnReceiptBlob } from '@/lib/pdf-receipts'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyIds: string[] // Key IDs selected for return
  allKeys: Key[] // All keys to look up key details
  onSuccess: () => void
}

/**
 * Dialog for returning maintenance keys.
 * Uses ReturnKeysDialogBase for UI, handles maintenance-specific business logic.
 */
export function ReturnMaintenanceKeysDialog({
  open,
  onOpenChange,
  keyIds,
  allKeys,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [loanGroups, setLoanGroups] = useState<LoanGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set())
  const [returnNote, setReturnNote] = useState('')

  // Fetch loan information for all keys being returned
  useEffect(() => {
    if (!open) return

    const fetchLoans = async () => {
      setLoading(true)
      try {
        // Get all keys being returned
        const keysToReturn = allKeys.filter((k) => keyIds.includes(k.id))

        // Build a map of unique active maintenance loans
        const loansMap = new Map<string, LoanGroup>()

        for (const key of keysToReturn) {
          const loans = await keyLoanService.getByKeyId(key.id)
          const activeLoan = loans.find((loan) => !loan.returnedAt)

          if (activeLoan) {
            if (!loansMap.has(activeLoan.id)) {
              // Parse all keys in this loan
              const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')
              const loanKeys = allKeys.filter((k) => loanKeyIds.includes(k.id))

              loansMap.set(activeLoan.id, {
                loanId: activeLoan.id,
                loanLabel: activeLoan.contact || '',
                keys: loanKeys,
                disposedKeys: loanKeys.filter((k) => k.disposed),
                nonDisposedKeys: loanKeys.filter((k) => !k.disposed),
              })
            }
          }
        }

        setLoanGroups(Array.from(loansMap.values()))

        // Initialize selected keys - check all keys that were originally selected
        const initialSelectedKeys = new Set<string>()
        loansMap.forEach((loanInfo) => {
          loanInfo.nonDisposedKeys.forEach((key) => {
            if (keyIds.includes(key.id)) {
              initialSelectedKeys.add(key.id)
            }
          })
        })
        setSelectedKeyIds(initialSelectedKeys)
      } finally {
        setLoading(false)
      }
    }

    fetchLoans()
  }, [open, keyIds, allKeys])

  const handleToggleKey = (keyId: string, checked: boolean) => {
    const newSelected = new Set(selectedKeyIds)
    if (checked) {
      newSelected.add(keyId)
    } else {
      newSelected.delete(keyId)
    }
    setSelectedKeyIds(newSelected)
  }

  const handleAccept = async () => {
    setIsProcessing(true)

    try {
      // Update all loans to mark them as returned and create return receipts
      await Promise.all(
        loanGroups.map(async (loanGroup) => {
          // Get the loan details
          const loan = await keyLoanService.get(loanGroup.loanId)

          // Update loan to mark as returned
          await keyLoanService.update(loanGroup.loanId, {
            returnedAt: new Date().toISOString(),
            description: returnNote.trim() || undefined,
          })

          // Create return receipt
          try {
            const receipt = await receiptService.create({
              keyLoanId: loanGroup.loanId,
              receiptType: 'RETURN',
              type: 'PHYSICAL',
            })

            // Generate and upload PDF automatically
            try {
              // Fetch all key objects for this loan
              const loanKeyIds: string[] = JSON.parse(loan.keys || '[]')
              const loanKeys: Key[] = await Promise.all(
                loanKeyIds.map((keyId) => keyService.getKey(keyId))
              )

              // Categorize keys into returned/missing/disposed
              const returned: Key[] = []
              const missing: Key[] = []
              const disposed: Key[] = []

              loanKeys.forEach((key) => {
                if (key.disposed) {
                  disposed.push(key)
                } else if (selectedKeyIds.has(key.id)) {
                  returned.push(key)
                } else {
                  missing.push(key)
                }
              })

              // Generate PDF
              const { blob } = await generateMaintenanceReturnReceiptBlob(
                {
                  contact: loan.contact || 'Unknown',
                  contactPerson: loan.contactPerson,
                  description: loan.description,
                  keys: returned,
                  receiptType: 'RETURN',
                  operationDate: new Date(),
                  missingKeys: missing.length > 0 ? missing : undefined,
                  disposedKeys: disposed.length > 0 ? disposed : undefined,
                },
                receipt.id
              )

              // Convert blob to File and upload
              const fileName = `return-receipt-${receipt.id}.pdf`
              const file = new File([blob], fileName, {
                type: 'application/pdf',
              })
              await receiptService.uploadFile(receipt.id, file)
            } catch (pdfErr) {
              console.error('Failed to generate/upload PDF:', pdfErr)
              // Don't fail the return if PDF generation fails
            }
          } catch (receiptErr) {
            console.error('Failed to create return receipt:', receiptErr)
            // Don't fail the return if receipt creation fails
          }
        })
      )

      toast({
        title: 'Nycklar återlämnade',
        description: `${loanGroups.reduce((sum, group) => sum + group.keys.length, 0)} nycklar har återlämnats`,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Fel',
        description: err?.message || 'Kunde inte återlämna nycklar',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Right side content - return note
  const rightContent = (
    <div className="space-y-3">
      <Label htmlFor="returnNote">Anteckning vid återlämning (valfritt)</Label>
      <Textarea
        id="returnNote"
        value={returnNote}
        onChange={(e) => setReturnNote(e.target.value)}
        placeholder="T.ex. Alla nycklar returnerade i gott skick"
        rows={4}
        disabled={isProcessing}
      />
      <div className="text-xs text-muted-foreground">
        Anteckningen sparas tillsammans med återlämningsdatumet
      </div>
    </div>
  )

  return (
    <ReturnKeysDialogBase
      open={open}
      onOpenChange={onOpenChange}
      loanGroups={loanGroups}
      loading={loading}
      selectedKeyIds={selectedKeyIds}
      onToggleKey={handleToggleKey}
      rightContent={rightContent}
      onAccept={handleAccept}
      isProcessing={isProcessing}
      acceptButtonText="Återlämna"
      title="Återlämna nycklar"
      description="Markera lån som återlämnat och lägg till en valfri anteckning"
    />
  )
}
