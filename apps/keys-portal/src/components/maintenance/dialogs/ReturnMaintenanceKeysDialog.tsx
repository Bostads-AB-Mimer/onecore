import { useState, useEffect } from 'react'
import type { Key, CardDetails } from '@/services/types'

// Store loan details for PDF generation
type LoanDetails = {
  contact: string
  contactName: string
  contactPerson: string | null
  description: string | null | undefined
}
import {
  ReturnKeysDialogBase,
  type LoanGroup,
} from '@/components/shared/dialogs/ReturnKeysDialogBase'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { generateAndUploadMaintenanceReturnReceipt } from '@/services/receiptHandlers'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyIds: string[] // Key IDs selected for return
  cardIds?: string[] // Card IDs selected for return
  allKeys: Key[] // All keys to look up key details
  allCards?: CardDetails[] // All cards to look up card details
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
  cardIds = [],
  allKeys,
  allCards = [],
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [loanGroups, setLoanGroups] = useState<LoanGroup[]>([])
  const [loanDetailsMap, setLoanDetailsMap] = useState<Map<string, LoanDetails>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set())
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
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
        const detailsMap = new Map<string, LoanDetails>()

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

              // Fetch contact info for company name
              const contactInfo = activeLoan.contact
                ? await fetchContactByContactCode(activeLoan.contact)
                : null
              const contactName = contactInfo?.fullName || activeLoan.contact || 'Unknown'

              // Store loan details for PDF generation
              detailsMap.set(activeLoan.id, {
                contact: activeLoan.contact || 'Unknown',
                contactName,
                contactPerson: activeLoan.contactPerson ?? null,
                description: activeLoan.description,
              })
            }
          }
        }

        setLoanGroups(Array.from(loansMap.values()))
        setLoanDetailsMap(detailsMap)

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
          // Update loan to mark as returned
          await keyLoanService.update(loanGroup.loanId, {
            returnedAt: new Date().toISOString(),
            description: returnNote.trim() || undefined,
          })

          // Create return receipt and generate PDF
          try {
            const receipt = await receiptService.create({
              keyLoanId: loanGroup.loanId,
              receiptType: 'RETURN',
              type: 'PHYSICAL',
            })

            // Generate and upload return receipt PDF
            const loanDetails = loanDetailsMap.get(loanGroup.loanId)
            if (loanDetails && receipt.id) {
              try {
                await generateAndUploadMaintenanceReturnReceipt(
                  receipt.id,
                  loanDetails.contact,
                  loanDetails.contactName,
                  loanDetails.contactPerson,
                  loanDetails.description,
                  loanGroup.keys,
                  selectedKeyIds
                )
              } catch (pdfErr) {
                console.error('Failed to generate/upload PDF:', pdfErr)
                // Don't fail the return if PDF generation fails
              }
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
