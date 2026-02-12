import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import type {
  Key,
  Lease,
  CardDetails,
  KeyLoanWithDetails,
} from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { BeforeAfterDialogBase } from './BeforeAfterDialogBase'
import { handleReturnKeys } from '@/services/loanHandlers'
import { useToast } from '@/hooks/use-toast'
import { keyLoanService } from '@/services/api/keyLoanService'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { CommentInput } from '@/components/shared/CommentInput'
import { AvailabilityDatePicker } from '@/components/shared/AvailabilityDatePicker'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'

type KeysByLoan = {
  loanId: string
  contact: string | null
  keys: Key[]
  disposedKeys: Key[]
  nonDisposedKeys: Key[]
}

type CardsByLoan = {
  loanId: string
  contact: string | null
  cards: CardDetails[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyIds: string[] // Key IDs selected for return
  cardIds?: string[] // Card IDs selected for return
  allKeys: Key[] // All keys to look up key details
  allCards?: CardDetails[] // All cards to look up card details
  lease: Lease
  onSuccess: () => void
}

export function ReturnKeysDialog({
  open,
  onOpenChange,
  keyIds,
  cardIds = [],
  allKeys,
  allCards = [],
  lease,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const { addSignature } = useCommentWithSignature()
  const [isProcessing, setIsProcessing] = useState(false)
  const [keysByLoan, setKeysByLoan] = useState<KeysByLoan[]>([])
  const [cardsByLoan, setCardsByLoan] = useState<CardsByLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set())
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [availableDate, setAvailableDate] = useState<Date | undefined>(
    undefined
  )
  const [comment, setComment] = useState('')

  // Initialize available date to lease end date
  useEffect(() => {
    if (lease.leaseEndDate) {
      setAvailableDate(new Date(lease.leaseEndDate))
    } else {
      setAvailableDate(undefined)
    }
  }, [lease.leaseEndDate])

  // Fetch loan information for all keys and cards being returned
  // Optimized: fetch one at a time, then skip IDs already covered by found loans
  useEffect(() => {
    if (!open) return

    const fetchLoans = async () => {
      setLoading(true)
      try {
        const remainingKeyIds = new Set(keyIds)
        const remainingCardIds = new Set(cardIds)
        const uniqueActiveLoans = new Map<string, KeyLoanWithDetails>()

        // Process until all IDs are accounted for
        while (remainingKeyIds.size > 0 || remainingCardIds.size > 0) {
          let loans
          let fetchedId: string

          // Pick one ID to fetch - prefer keys first
          if (remainingKeyIds.size > 0) {
            fetchedId = remainingKeyIds.values().next().value
            loans = await keyLoanService.getByKeyId(fetchedId)
          } else {
            fetchedId = remainingCardIds.values().next().value
            loans = await keyLoanService.getByCardId(fetchedId)
          }

          const activeLoan = loans.find((loan) => !loan.returnedAt)

          if (activeLoan && !uniqueActiveLoans.has(activeLoan.id)) {
            // Fetch with details to get key/card arrays
            const enriched = (await keyLoanService.get(activeLoan.id, {
              includeCards: true,
            })) as KeyLoanWithDetails
            uniqueActiveLoans.set(activeLoan.id, enriched)

            // Remove all keys/cards from this loan from remaining sets
            const loanKeyIds = enriched.keysArray?.map((k) => k.id) || []
            const loanCardIds =
              enriched.keyCardsArray?.map((c) => c.cardId) || []
            loanKeyIds.forEach((id) => remainingKeyIds.delete(id))
            loanCardIds.forEach((id) => remainingCardIds.delete(id))
          } else {
            // No active loan found for this ID - remove it to prevent infinite loop
            if (remainingKeyIds.has(fetchedId)) {
              remainingKeyIds.delete(fetchedId)
            } else {
              remainingCardIds.delete(fetchedId)
            }
          }
        }

        // Build keysLoansMap and cardsLoansMap from enriched loans
        const keysLoansMap = new Map<string, KeysByLoan>()
        const cardsLoansMap = new Map<string, CardsByLoan>()

        uniqueActiveLoans.forEach((enrichedLoan, loanId) => {
          // Use keysArray from enriched loan, match against allKeys for consistent objects
          const loanKeyIds = enrichedLoan.keysArray?.map((k) => k.id) || []
          if (loanKeyIds.length > 0) {
            const loanKeys = allKeys.filter((k) => loanKeyIds.includes(k.id))
            keysLoansMap.set(loanId, {
              loanId,
              contact: enrichedLoan.contact || null,
              keys: loanKeys,
              disposedKeys: loanKeys.filter((k) => k.disposed),
              nonDisposedKeys: loanKeys.filter((k) => !k.disposed),
            })
          }

          // Use keyCardsArray from enriched loan
          const loanCardIds =
            enrichedLoan.keyCardsArray?.map((c) => c.cardId) || []
          if (loanCardIds.length > 0) {
            const loanCards = allCards.filter((c) =>
              loanCardIds.includes(c.cardId)
            )
            cardsLoansMap.set(loanId, {
              loanId,
              contact: enrichedLoan.contact || null,
              cards: loanCards,
            })
          }
        })

        setKeysByLoan(Array.from(keysLoansMap.values()))
        setCardsByLoan(Array.from(cardsLoansMap.values()))

        // Initialize selected keys - only check keys that were originally selected
        const initialSelectedKeys = new Set<string>()
        keysLoansMap.forEach((loanInfo) => {
          loanInfo.nonDisposedKeys.forEach((key) => {
            if (keyIds.includes(key.id)) {
              initialSelectedKeys.add(key.id)
            }
          })
        })
        setSelectedKeyIds(initialSelectedKeys)

        // Initialize selected cards - only check cards that were originally selected
        const initialSelectedCards = new Set<string>()
        cardsLoansMap.forEach((loanInfo) => {
          loanInfo.cards.forEach((card) => {
            if (cardIds.includes(card.cardId)) {
              initialSelectedCards.add(card.cardId)
            }
          })
        })
        setSelectedCardIds(initialSelectedCards)
      } finally {
        setLoading(false)
      }
    }

    fetchLoans()
  }, [open, keyIds, cardIds, allKeys, allCards])

  const handleAccept = async () => {
    setIsProcessing(true)

    try {
      // Get all key IDs from all loans (must return entire loan)
      const allKeyIdsToReturn = Array.from(
        new Set(
          keysByLoan.flatMap((loanInfo) => loanInfo.keys.map((k) => k.id))
        )
      )

      // Get all card IDs from all loans
      const allCardIdsToReturn = Array.from(
        new Set(
          cardsByLoan.flatMap((loanInfo) => loanInfo.cards.map((c) => c.cardId))
        )
      )

      const result = await handleReturnKeys({
        keyIds: allKeyIdsToReturn,
        cardIds: allCardIdsToReturn,
        availableToNextTenantFrom: availableDate?.toISOString(),
        selectedForReceipt: Array.from(selectedKeyIds),
        selectedCardsForReceipt: Array.from(selectedCardIds),
        lease,
        comment: addSignature(comment),
      })

      if (result.success) {
        toast({
          title: result.title,
          description: result.message,
        })
        onOpenChange(false)
        onSuccess()
      } else {
        toast({
          title: result.title,
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Fel',
        description: err?.message || 'Kunde inte återlämna nycklar/droppar',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const totalKeys = keysByLoan.reduce(
    (sum, loanInfo) => sum + loanInfo.keys.length,
    0
  )
  const totalCards = cardsByLoan.reduce(
    (sum, loanInfo) => sum + loanInfo.cards.length,
    0
  )
  const totalItems = totalKeys + totalCards

  // Left side content - keys and cards being returned grouped by loan
  const leftContent = loading ? (
    <div className="text-sm text-muted-foreground">Laddar...</div>
  ) : (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {/* Keys section */}
      {keysByLoan.length > 0 && (
        <>
          {totalCards > 0 && (
            <div className="text-xs font-semibold text-muted-foreground">
              Nycklar
            </div>
          )}
          {keysByLoan.map((loanInfo, index) => {
            const showLoanGrouping = keysByLoan.length > 1

            return (
              <div
                key={loanInfo.loanId}
                className={cn(
                  showLoanGrouping &&
                    'p-3 border rounded-lg bg-muted/30 space-y-2'
                )}
              >
                {showLoanGrouping && (
                  <div className="text-xs font-semibold text-muted-foreground">
                    Lån {index + 1}
                    {loanInfo.contact && ` • ${loanInfo.contact}`}
                  </div>
                )}

                {/* Non-disposed keys with checkboxes */}
                {loanInfo.nonDisposedKeys.length > 0 && (
                  <div className="space-y-2">
                    {loanInfo.nonDisposedKeys.map((key) => (
                      <div
                        key={key.id}
                        className="p-3 border rounded-lg bg-muted/50 text-sm flex items-start gap-3"
                      >
                        <Checkbox
                          checked={selectedKeyIds.has(key.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedKeyIds)
                            if (checked) {
                              newSelected.add(key.id)
                            } else {
                              newSelected.delete(key.id)
                            }
                            setSelectedKeyIds(newSelected)
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{key.keyName}</div>
                          <div className="text-xs text-muted-foreground">
                            {KeyTypeLabels[key.keyType]}
                            {key.flexNumber !== undefined &&
                              ` • Flex: ${key.flexNumber}`}
                            {key.keySequenceNumber !== undefined &&
                              ` • Sekv: ${key.keySequenceNumber}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disposed keys (no checkboxes) */}
                {loanInfo.disposedKeys.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Kasserade:
                    </div>
                    {loanInfo.disposedKeys.map((key) => (
                      <div
                        key={key.id}
                        className="p-3 border rounded-lg bg-destructive/5 border-destructive/20 text-sm"
                      >
                        <div className="font-medium text-destructive">
                          {key.keyName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {KeyTypeLabels[key.keyType]}
                          {key.flexNumber !== undefined &&
                            ` • Flex: ${key.flexNumber}`}
                          {key.keySequenceNumber !== undefined &&
                            ` • Sekv: ${key.keySequenceNumber}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Cards section */}
      {cardsByLoan.length > 0 && (
        <>
          {totalKeys > 0 && (
            <div className="text-xs font-semibold text-muted-foreground mt-4">
              Droppar
            </div>
          )}
          {cardsByLoan.map((loanInfo) => (
            <div key={loanInfo.loanId} className="space-y-2">
              {loanInfo.cards.map((card) => (
                <div
                  key={card.cardId}
                  className="p-3 border rounded-lg bg-muted/50 text-sm flex items-start gap-3"
                >
                  <Checkbox
                    checked={selectedCardIds.has(card.cardId)}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedCardIds)
                      if (checked) {
                        newSelected.add(card.cardId)
                      } else {
                        newSelected.delete(card.cardId)
                      }
                      setSelectedCardIds(newSelected)
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {card.name || card.cardId}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )

  // Right side content - date picker and comment
  const rightContent = (
    <div className="space-y-4">
      <AvailabilityDatePicker
        availableDate={availableDate}
        onDateChange={setAvailableDate}
      />

      <CommentInput
        value={comment}
        onChange={setComment}
        placeholder="Lägg till en kommentar på kvittensen..."
      />
    </div>
  )

  // Dynamic titles based on what's being returned
  const hasOnlyKeys = totalKeys > 0 && totalCards === 0
  const hasOnlyCards = totalCards > 0 && totalKeys === 0
  const title = hasOnlyKeys
    ? 'Återlämna nycklar'
    : hasOnlyCards
      ? 'Återlämna droppar'
      : 'Återlämna nycklar och droppar'
  const leftTitle = hasOnlyKeys
    ? 'Nycklar som återlämnas'
    : hasOnlyCards
      ? 'Droppar som återlämnas'
      : 'Nycklar och droppar som återlämnas'

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Välj vilka som ska visas på kvittensen och när de blir tillgängliga för nästa hyresgäst."
      leftTitle={leftTitle}
      rightTitle="Tillgängligt från"
      leftContent={leftContent}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={handleAccept}
      acceptButtonText="Återlämna"
      totalCount={totalItems}
    />
  )
}
