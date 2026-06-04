import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Printer, AlertCircle } from 'lucide-react'

import { printReceipt } from '@/services/loans/receiptPrint'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'
import { useReceiptPreparation } from '@/hooks/useReceiptPreparation'

type ReceiptDialogProps = {
  isOpen: boolean
  onClose: () => void
  /** A pending LOAN receipt to sign+print; omit for a reprint driven by `loanId`. */
  receiptId?: string | null
  /** The loan to print a receipt for; required when there is no `receiptId`. */
  loanId?: string | null
}

/**
 * Prints a LOAN receipt (tenant or maintenance) so it can be signed. Return receipts
 * are auto-generated and stored by the return flow, so they never open this dialog.
 */
export function ReceiptDialog({
  isOpen,
  onClose,
  receiptId = null,
  loanId = null,
}: ReceiptDialogProps) {
  const { addSignature } = useCommentWithSignature()
  const [comment, setComment] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  const { receiptData, isLoading, error, canPrint, contract, getPrintData } =
    useReceiptPreparation({ isOpen, receiptId, loanId })

  const isMaintenance = receiptData?.loanType === 'MAINTENANCE'
  const isReprint = !receiptId
  const signerLabel = isMaintenance ? 'entreprenören' : 'hyresgästen'

  const handlePrint = async () => {
    const data = getPrintData(addSignature(comment))
    if (!data) return
    setIsPrinting(true)
    try {
      await printReceipt(data)
    } finally {
      setIsPrinting(false)
    }
  }

  // Avtal pickers are tenant-only; maintenance receipts carry no object/Avtal.
  const showAvtal = !isMaintenance && !!receiptData && !error
  const { objectOptions, leaseMatches, selectedObjectId, leaseDisplayId } =
    contract

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isReprint
              ? 'Skriv ut lånkvittens'
              : 'Nycklar utlånade framgångsrikt'}
          </DialogTitle>
          <DialogDescription>
            {isReprint
              ? `Skriv ut kvittensen och låt ${signerLabel} signera.`
              : `En utlåningskvittens har skapats. Skriv ut och låt ${signerLabel} signera.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Blocking error: borrower couldn't be resolved from the loan */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Signing reminder */}
          {!error && (
            <Alert
              variant="default"
              className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
            >
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                <strong>Signering krävs:</strong> Utlåningskvittensen ska
                signeras av {signerLabel}.
              </AlertDescription>
            </Alert>
          )}

          {/* Pick a rental object when the loan's keys span several */}
          {showAvtal && objectOptions.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Välj hyresobjekt</p>
              <p className="text-xs text-muted-foreground">
                Lånet innehåller nycklar för flera objekt. Välj vilket som ska
                stå på kvittensen.
              </p>
              <div className="space-y-1">
                {objectOptions.map((o) => (
                  <label
                    key={o.rentalPropertyId}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="object-pick"
                      checked={selectedObjectId === o.rentalPropertyId}
                      onChange={() => contract.selectObject(o.rentalPropertyId)}
                    />
                    <span className="tabular-nums">{o.rentalPropertyId}</span>
                    {o.address && (
                      <span className="text-muted-foreground">{o.address}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Pick a contract when several match the loan's contact */}
          {showAvtal && leaseMatches.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Välj avtal</p>
              <p className="text-xs text-muted-foreground">
                Flera avtal matchar lånets kontakt. Välj vilket som ska stå på
                kvittensen.
              </p>
              <div className="space-y-1">
                {leaseMatches.map((l) => (
                  <label
                    key={l.leaseId}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="lease-pick"
                      checked={leaseDisplayId === l.leaseId}
                      onChange={() => contract.setLeaseDisplayId(l.leaseId)}
                    />
                    <span className="tabular-nums">{l.leaseId}</span>
                    <span className="text-muted-foreground">
                      {(l.tenants ?? [])
                        .map(
                          (t) =>
                            t.fullName ||
                            `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim()
                        )
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* No matching contract → optional manual Avtals-ID */}
          {showAvtal &&
            objectOptions.length <= 1 &&
            leaseMatches.length === 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="manual-lease-id"
                  className="text-sm font-medium"
                >
                  Avtals-ID (valfritt)
                </label>
                <p className="text-xs text-muted-foreground">
                  Inget avtal hittades för lånets kontakt på hyresobjektet. Ange
                  avtals-ID manuellt om du vill.
                </p>
                <input
                  id="manual-lease-id"
                  type="text"
                  value={leaseDisplayId}
                  onChange={(e) => contract.setLeaseDisplayId(e.target.value)}
                  placeholder="t.ex. 123-456-78/9"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}

          <CommentInput
            value={comment}
            onChange={setComment}
            placeholder="Lägg till en kommentar på kvittensen..."
          />

          <Button
            onClick={handlePrint}
            className="gap-2 w-full"
            disabled={!canPrint || isPrinting}
          >
            <Printer className="h-4 w-4" />
            {isLoading || isPrinting
              ? 'Laddar kvittens...'
              : 'Skriv ut kvittens'}
          </Button>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
