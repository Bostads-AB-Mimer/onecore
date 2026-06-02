import { useState, useEffect } from 'react'
import type {
  KeyDetails,
  CardDetails,
  KeyLoanWithDetails,
} from '@/services/types'

// Store loan details for PDF generation
type LoanDetails = {
  contact: string
  contactName: string
  contactPerson: string | null
  notes: string | null | undefined
}
import {
  ReturnKeysDialogBase,
  type LoanGroup,
} from '@/components/shared/dialogs/ReturnKeysDialogBase'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { generateAndUploadMaintenanceReturnReceipt } from '@/services/receiptHandlers'
import { handlePartialReturn } from '@/services/loanHandlers'
import { useToast } from '@/hooks/use-toast'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyIds: string[] // Key IDs selected for return
  cardIds?: string[] // Card IDs selected for return
  allKeys: KeyDetails[] // All keys to look up key details
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
  const { addSignature } = useCommentWithSignature()
  const [isProcessing, setIsProcessing] = useState(false)
  const [loanGroups, setLoanGroups] = useState<LoanGroup[]>([])
  const [loanDetailsMap, setLoanDetailsMap] = useState<
    Map<string, LoanDetails>
  >(new Map())
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
              // Fetch loan with details to get key IDs
              const enriched = (await keyLoanService.get(activeLoan.id, {
                includeCards: true,
              })) as KeyLoanWithDetails
              const loanKeyIds = enriched.keysArray?.map((k) => k.id) || []
              const loanKeys = allKeys.filter((k) => loanKeyIds.includes(k.id))

              loansMap.set(activeLoan.id, {
                loanId: activeLoan.id,
                loanLabel: activeLoan.contact || '',
                keys: loanKeys,
              })

              // Fetch contact info for company name
              const contactInfo = activeLoan.contact
                ? await fetchContactByContactCode(activeLoan.contact)
                : null
              const contactName =
                contactInfo?.fullName || activeLoan.contact || 'Unknown'

              // Store loan details for PDF generation
              detailsMap.set(activeLoan.id, {
                contact: activeLoan.contact || 'Unknown',
                contactName,
                contactPerson: activeLoan.contactPerson ?? null,
                notes: activeLoan.notes,
              })
            }
          }
        }

        setLoanGroups(Array.from(loansMap.values()))
        setLoanDetailsMap(detailsMap)

        // Initialize selected keys - check all keys that were originally selected
        const initialSelectedKeys = new Set<string>()
        loansMap.forEach((loanInfo) => {
          loanInfo.keys
            .filter((k) => !k.disposed)
            .forEach((key) => {
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

  // Closes a single maintenance loan with a return receipt that lists checked
  // keys as returned and any unchecked as missing. Used for both "Retur med
  // saknade nycklar" and for fully-selected loans in a partial-return click.
  const closeLoanAsReturn = async (loanGroup: LoanGroup) => {
    await keyLoanService.update(loanGroup.loanId, {
      returnedAt: new Date().toISOString(),
      notes: returnNote.trim() || undefined,
    })
    try {
      const receipt = await receiptService.create({
        keyLoanId: loanGroup.loanId,
        receiptType: 'RETURN',
        type: 'PHYSICAL',
      })
      const loanDetails = loanDetailsMap.get(loanGroup.loanId)
      if (loanDetails && receipt.id) {
        try {
          const noteForPdf = addSignature(returnNote) || loanDetails.notes
          await generateAndUploadMaintenanceReturnReceipt({
            receiptId: receipt.id,
            contact: loanDetails.contact,
            contactName: loanDetails.contactName,
            contactPerson: loanDetails.contactPerson,
            description: noteForPdf,
            loanKeys: loanGroup.keys,
            selectedKeyIds,
          })
        } catch (pdfErr) {
          console.error('Failed to generate/upload PDF:', pdfErr)
        }
      }
    } catch (receiptErr) {
      console.error('Failed to create return receipt:', receiptErr)
    }
  }

  const handleAccept = async () => {
    setIsProcessing(true)

    try {
      await Promise.all(loanGroups.map(closeLoanAsReturn))

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

  // Partial-return accept: per loan, decide whether the selection covers every
  // non-disposed key (full-return, runs the existing close path) or only some
  // (partial-return, runs handlePartialReturn which creates a continuation loan
  // for the unchecked keys).
  const handlePartialAccept = async () => {
    setIsProcessing(true)
    try {
      const failures: string[] = []
      let warnings = 0

      for (const loanGroup of loanGroups) {
        const nonDisposed = loanGroup.keys.filter((k) => !k.disposed)
        const selectedCount = nonDisposed.filter((k) =>
          selectedKeyIds.has(k.id)
        ).length

        if (selectedCount === 0) continue

        if (selectedCount === nonDisposed.length) {
          await closeLoanAsReturn(loanGroup)
        } else {
          const details = loanDetailsMap.get(loanGroup.loanId)
          if (!details) {
            failures.push(`Lån ${loanGroup.loanId}: saknar låneuppgifter`)
            continue
          }
          const result = await handlePartialReturn({
            oldLoanId: loanGroup.loanId,
            selectedKeyIds,
            selectedCardIds: new Set(),
            maintenanceContext: {
              contact: details.contact,
              contactName: details.contactName,
              contactPerson: details.contactPerson,
              notes: addSignature(returnNote) || details.notes,
            },
          })
          if (!result.success) {
            failures.push(result.message ?? 'Okänt fel')
          } else if (result.fellBackToReturnOnly) {
            warnings++
          }
        }
      }

      if (failures.length > 0) {
        toast({
          title: 'Partiell retur misslyckades för vissa lån',
          description: failures.join('\n'),
          variant: 'destructive',
        })
        return
      }

      if (warnings > 0) {
        toast({
          title: 'Partiell retur klar — varning',
          description:
            'Det fanns ingen ursprunglig låneblankett att kombinera; den nya låneblanketten innehåller bara återlämningskvittensen.',
        })
      } else {
        toast({
          title: 'Partiell retur klar',
        })
      }
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Fel',
        description: err?.message || 'Kunde inte genomföra partiell retur.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const partialMode = loanGroups.some((g) => {
    const nonDisposed = g.keys.filter((k) => !k.disposed)
    const sel = nonDisposed.filter((k) => selectedKeyIds.has(k.id)).length
    return sel > 0 && sel < nonDisposed.length
  })

  // Right side content - return note
  const rightContent = (
    <div className="space-y-3">
      <CommentInput
        value={returnNote}
        onChange={setReturnNote}
        label="Anteckning vid återlämning"
        placeholder="T.ex. Alla nycklar returnerade i gott skick"
        rows={4}
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
      onAccept={partialMode ? handlePartialAccept : handleAccept}
      isProcessing={isProcessing}
      acceptButtonText={partialMode ? 'Partiell retur' : 'Återlämna'}
      primaryLabel={partialMode ? 'Partiell retur' : 'Återlämna'}
      title="Återlämna nycklar"
      description="Markera lån som återlämnat och lägg till en valfri anteckning"
      secondaryAction={
        partialMode
          ? {
              label: 'Retur med saknade nycklar',
              onClick: handleAccept,
              variant: 'secondary',
            }
          : undefined
      }
    />
  )
}
