import { useState } from 'react'
import type { Key, CardDetails } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { BeforeAfterDialogBase } from './BeforeAfterDialogBase'
import type { ExistingLoanInfo } from '@/services/loanTransferHelpers'
import { AlertCircle } from 'lucide-react'
import { handleLoanKeys, handleReturnKeys } from '@/services/loanHandlers'
import { useToast } from '@/hooks/use-toast'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  newKeys?: Key[] // Keys being newly loaned
  newCards?: CardDetails[] // Cards being newly loaned
  existingLoans: ExistingLoanInfo[] // Existing loans that will be closed
  contact?: string
  contact2?: string
  onSuccess: (receiptId?: string) => void // Called after successful transfer
}

export function KeyLoanTransferDialog({
  open,
  onOpenChange,
  newKeys = [],
  newCards = [],
  existingLoans,
  contact,
  contact2,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAccept = async () => {
    setIsProcessing(true)

    try {
      // Step 1: Get all key and card IDs from existing loans to return
      const allExistingKeyIds = existingLoans.flatMap((loanInfo) =>
        loanInfo.keys.map((k) => k.id)
      )
      const allExistingCardIds = existingLoans.flatMap((loanInfo) =>
        loanInfo.cards.map((c) => c.cardId)
      )

      // Step 2: Return all keys/cards from existing loans (closes the loans)
      const returnResult = await handleReturnKeys({
        keyIds: allExistingKeyIds,
        cardIds: allExistingCardIds,
      })
      if (!returnResult.success) {
        toast({
          title: returnResult.title,
          description: returnResult.message,
          variant: 'destructive',
        })
        setIsProcessing(false)
        return
      }

      // Step 3: Get transferred IDs (non-disposed keys + all cards from old loans)
      // Deduplicate to prevent same item appearing multiple times if it's in multiple loans
      const transferredKeyIds = Array.from(
        new Set(
          existingLoans.flatMap((loanInfo) =>
            loanInfo.keysToTransfer.map((k) => k.id)
          )
        )
      )
      const transferredCardIds = Array.from(
        new Set(
          existingLoans.flatMap((loanInfo) =>
            loanInfo.cardsToTransfer.map((c) => c.cardId)
          )
        )
      )

      // Step 4: Create new loan with new items + transferred items
      // Deduplicate to ensure no item appears twice in the new loan
      const allNewLoanKeyIds = Array.from(
        new Set([...newKeys.map((k) => k.id), ...transferredKeyIds])
      )
      const allNewLoanCardIds = Array.from(
        new Set([...newCards.map((c) => c.cardId), ...transferredCardIds])
      )
      const loanResult = await handleLoanKeys({
        keyIds: allNewLoanKeyIds,
        cardIds: allNewLoanCardIds,
        contact,
        contact2,
      })

      if (loanResult.success) {
        const transferredKeysCount = transferredKeyIds.length
        const transferredCardsCount = transferredCardIds.length
        const totalTransferred = transferredKeysCount + transferredCardsCount
        const totalNew = newKeys.length + newCards.length
        const totalItems = allNewLoanKeyIds.length + allNewLoanCardIds.length
        toast({
          title: 'Lån överfört',
          description: `${totalItems} objekt utlånade (${totalNew} nya + ${totalTransferred} överförda)`,
        })
        onOpenChange(false)
        onSuccess(loanResult.receiptId)
      } else {
        toast({
          title: loanResult.title,
          description: loanResult.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Fel',
        description: err?.message || 'Kunde inte överföra lån',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }
  // Calculate all items for the new loan (new + transferred)
  const allTransferredKeys = existingLoans.flatMap(
    (info) => info.keysToTransfer
  )
  const allTransferredCards = existingLoans.flatMap(
    (info) => info.cardsToTransfer
  )
  const allDisposedKeys = existingLoans.flatMap((info) => info.disposedKeys)
  const totalNewLoanKeys = newKeys.length + allTransferredKeys.length
  const totalNewLoanCards = newCards.length + allTransferredCards.length
  const totalNewLoanItems = totalNewLoanKeys + totalNewLoanCards

  // Left side content - items from existing loans (showing what will be closed)
  const leftContent = (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {existingLoans.map((loanInfo) => (
        <div
          key={loanInfo.loan.id}
          className="p-3 border rounded-lg bg-muted/30 space-y-2"
        >
          <div className="text-xs font-semibold text-muted-foreground">
            Befintligt lån
            {loanInfo.loan.contact && ` • ${loanInfo.loan.contact}`}
          </div>

          {/* Keys to be transferred */}
          {loanInfo.keysToTransfer.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Nycklar som överförs:
              </div>
              {loanInfo.keysToTransfer.map((key) => (
                <div
                  key={key.id}
                  className="p-3 border rounded-lg bg-muted/50 text-sm"
                >
                  <div className="font-medium">{key.keyName}</div>
                  <div className="text-xs text-muted-foreground">
                    {KeyTypeLabels[key.keyType]}
                    {key.flexNumber !== undefined &&
                      ` • Flex: ${key.flexNumber}`}
                    {key.keySequenceNumber !== undefined &&
                      ` • Löpnr: ${key.keySequenceNumber}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cards to be transferred */}
          {loanInfo.cardsToTransfer.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Droppar som överförs:
              </div>
              {loanInfo.cardsToTransfer.map((card) => (
                <div
                  key={card.cardId}
                  className="p-3 border rounded-lg bg-muted/50 text-sm"
                >
                  <div className="font-medium">{card.name || card.cardId}</div>
                </div>
              ))}
            </div>
          )}

          {/* Disposed keys (shown but not transferred) */}
          {loanInfo.disposedKeys.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Kasserade (överförs ej):
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
                      ` • Löpnr: ${key.keySequenceNumber}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  // Right side content - new loan keys (new + transferred)
  const rightContent = (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {/* New keys */}
      {newKeys.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Nya nycklar ({newKeys.length})
          </div>
          {newKeys.map((key) => (
            <div key={key.id} className="p-2 border rounded bg-card text-xs">
              <div className="font-medium">{key.keyName}</div>
              <div className="text-muted-foreground">
                {KeyTypeLabels[key.keyType]}
                {key.flexNumber !== undefined && ` • Flex: ${key.flexNumber}`}
                {key.keySequenceNumber !== undefined &&
                  ` • Löpnr: ${key.keySequenceNumber}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transferred keys */}
      {allTransferredKeys.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Överförda nycklar ({allTransferredKeys.length})
          </div>
          {allTransferredKeys.map((key) => (
            <div
              key={key.id}
              className="p-2 border rounded bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30 text-xs"
            >
              <div className="font-medium">{key.keyName}</div>
              <div className="text-muted-foreground">
                {KeyTypeLabels[key.keyType]}
                {key.flexNumber !== undefined && ` • Flex: ${key.flexNumber}`}
                {key.keySequenceNumber !== undefined &&
                  ` • Löpnr: ${key.keySequenceNumber}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New cards */}
      {newCards.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Nya droppar ({newCards.length})
          </div>
          {newCards.map((card) => (
            <div
              key={card.cardId}
              className="p-2 border rounded bg-card text-xs"
            >
              <div className="font-medium">{card.name || card.cardId}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transferred cards */}
      {allTransferredCards.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Överförda droppar ({allTransferredCards.length})
          </div>
          {allTransferredCards.map((card) => (
            <div
              key={card.cardId}
              className="p-2 border rounded bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30 text-xs"
            >
              <div className="font-medium">{card.name || card.cardId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // Show empty state dialog if no existing loans
  if (existingLoans.length === 0) {
    return null // This shouldn't happen, but safety check
  }

  // Build transfer description based on what's being transferred
  const transferParts: string[] = []
  if (allTransferredKeys.length > 0) {
    transferParts.push(`${allTransferredKeys.length} nyckel/nycklar`)
  }
  if (allTransferredCards.length > 0) {
    transferParts.push(`${allTransferredCards.length} droppe/droppar`)
  }
  const transferText =
    transferParts.length > 0
      ? `${transferParts.join(' och ')} kommer att överföras till det nya lånet`
      : 'inga objekt kommer att överföras'

  const description =
    existingLoans.length === 1
      ? `Det finns ett aktivt lån för denna kontakt på objektet. Det befintliga lånet kommer att avslutas och ${transferText}.${allDisposedKeys.length > 0 ? ` ${allDisposedKeys.length} kasserad(e) nyckel/nycklar visas men överförs inte.` : ''}`
      : `Det finns ${existingLoans.length} aktiva lån för denna kontakt på objektet. De befintliga lånen kommer att avslutas och ${transferText}.${allDisposedKeys.length > 0 ? ` ${allDisposedKeys.length} kasserad(e) nyckel/nycklar visas men överförs inte.` : ''}`

  // Build right title showing keys and/or cards
  const rightTitleParts: string[] = []
  if (totalNewLoanKeys > 0) {
    rightTitleParts.push(`${totalNewLoanKeys} nycklar`)
  }
  if (totalNewLoanCards > 0) {
    rightTitleParts.push(`${totalNewLoanCards} droppar`)
  }
  const rightTitle = `Nytt lån (${rightTitleParts.join(', ')})`

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Överföring av nyckellån"
      description={description}
      leftTitle={`Befintliga lån (${existingLoans.length})`}
      rightTitle={rightTitle}
      leftContent={leftContent}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={handleAccept}
      acceptButtonText="Överför"
      totalCount={totalNewLoanItems}
    />
  )
}
