import { useState } from 'react'
import type { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { BeforeAfterDialogBase } from './BeforeAfterDialogBase'
import type { ExistingLoanInfo } from '@/services/loanTransferHelpers'
import { AlertCircle } from 'lucide-react'
import { handleLoanKeys, handleReturnKeys } from '@/services/loanHandlers'
import { useToast } from '@/hooks/use-toast'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  newKeys: Key[] // Keys being newly loaned
  existingLoans: ExistingLoanInfo[] // Existing loans that will be closed
  contact?: string
  contact2?: string
  onSuccess: (receiptId?: string) => void // Called after successful transfer
}

export function KeyLoanTransferDialog({
  open,
  onOpenChange,
  newKeys,
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
      // Step 1: Get all key IDs from existing loans to return
      const allExistingKeyIds = existingLoans.flatMap((loanInfo) =>
        loanInfo.keys.map((k) => k.id)
      )

      // Step 2: Return all keys from existing loans (closes the loans)
      const returnResult = await handleReturnKeys({ keyIds: allExistingKeyIds })
      if (!returnResult.success) {
        toast({
          title: returnResult.title,
          description: returnResult.message,
          variant: 'destructive',
        })
        setIsProcessing(false)
        return
      }

      // Step 3: Get transferred key IDs (non-disposed keys from old loans)
      const transferredKeyIds = existingLoans.flatMap((loanInfo) =>
        loanInfo.keysToTransfer.map((k) => k.id)
      )

      // Step 4: Create new loan with new keys + transferred keys
      const allNewLoanKeyIds = [
        ...newKeys.map((k) => k.id),
        ...transferredKeyIds,
      ]
      const loanResult = await handleLoanKeys({
        keyIds: allNewLoanKeyIds,
        contact,
        contact2,
      })

      if (loanResult.success) {
        const transferCount = transferredKeyIds.length
        toast({
          title: 'Nyckellån överfört',
          description: `${allNewLoanKeyIds.length} nycklar utlånade (${newKeys.length} nya + ${transferCount} överförda)`,
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
        description: err?.message || 'Kunde inte överföra nyckellån',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }
  // Calculate all keys for the new loan (new + transferred)
  const allTransferredKeys = existingLoans.flatMap(
    (info) => info.keysToTransfer
  )
  const allDisposedKeys = existingLoans.flatMap((info) => info.disposedKeys)
  const totalNewLoanKeys = newKeys.length + allTransferredKeys.length

  // Left side content - keys from existing loans (showing what will be closed)
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
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Överförs till nytt lån:
              </div>
              {loanInfo.keysToTransfer.map((key) => (
                <div
                  key={key.id}
                  className="p-2 border rounded bg-card text-xs"
                >
                  <div className="font-medium">{key.keyName}</div>
                  <div className="text-muted-foreground">
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

          {/* Disposed keys (shown but not transferred) */}
          {loanInfo.disposedKeys.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Kasserade (överförs ej):
              </div>
              {loanInfo.disposedKeys.map((key) => (
                <div
                  key={key.id}
                  className="p-2 border rounded bg-destructive/5 border-destructive/20 text-xs"
                >
                  <div className="font-medium text-destructive">
                    {key.keyName}
                  </div>
                  <div className="text-muted-foreground">
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
                  ` • Sekv: ${key.keySequenceNumber}`}
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
                  ` • Sekv: ${key.keySequenceNumber}`}
              </div>
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

  const description =
    existingLoans.length === 1
      ? `Det finns ett aktivt lån för denna kontakt på objektet. Det befintliga lånet kommer att avslutas och ${allTransferredKeys.length > 0 ? 'nycklarna kommer att överföras till det nya lånet' : 'inga nycklar kommer att överföras'}.${allDisposedKeys.length > 0 ? ` ${allDisposedKeys.length} kasserad(e) nyckel/nycklar visas men överförs inte.` : ''}`
      : `Det finns ${existingLoans.length} aktiva lån för denna kontakt på objektet. De befintliga lånen kommer att avslutas och ${allTransferredKeys.length > 0 ? 'nycklarna kommer att överföras till det nya lånet' : 'inga nycklar kommer att överföras'}.${allDisposedKeys.length > 0 ? ` ${allDisposedKeys.length} kasserad(e) nyckel/nycklar visas men överförs inte.` : ''}`

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Överföring av nyckellån"
      description={description}
      leftTitle={`Befintliga lån (${existingLoans.length})`}
      rightTitle={`Nytt lån (${totalNewLoanKeys} nycklar)`}
      leftContent={leftContent}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={handleAccept}
      acceptButtonText="Överför"
      totalCount={totalNewLoanKeys}
    />
  )
}
