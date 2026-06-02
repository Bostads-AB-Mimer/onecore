import { useState, useEffect } from 'react'
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

import type { ReceiptData } from '@/services/types'
import {
  prepareReceipt,
  openPdfInNewTab,
  openMaintenanceReceiptInNewTab,
  type LoanObjectOption,
} from '@/services/receiptHandlers'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'

type TenantReceiptProps = {
  isOpen: boolean
  onClose: () => void
  receiptId: string | null
  loanType?: 'TENANT'
  loanId?: string
}

type MaintenanceReceiptProps = {
  isOpen: boolean
  onClose: () => void
  receiptId?: string | null
  lease?: never
  loanType: 'MAINTENANCE'
  loanId: string | null
}

type ReceiptDialogProps = TenantReceiptProps | MaintenanceReceiptProps

export function ReceiptDialog(props: ReceiptDialogProps) {
  const { isOpen, onClose, loanType = 'TENANT' } = props
  const isMaintenance = loanType === 'MAINTENANCE'

  const { addSignature } = useCommentWithSignature()

  // Tenant mode: fetch receipt data
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  // Rental objects on the loan (each with its matching leases). >1 → object picker
  // first; then per-object lease step. selectedObjectId/leaseDisplayId hold the
  // chosen object and the chosen/typed Avtals-ID, merged into the PDF at print.
  const [objectOptions, setObjectOptions] = useState<LoanObjectOption[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [leaseDisplayId, setLeaseDisplayId] = useState('')

  // Fetch receipt data when dialog opens (tenant mode only)
  useEffect(() => {
    if (isMaintenance) return

    const { receiptId, loanId } = props as TenantReceiptProps

    if (!isOpen || (!receiptId && !loanId)) {
      setReceiptData(null)
      setComment('')
      setLoadError(null)
      setObjectOptions([])
      setSelectedObjectId('')
      setLeaseDisplayId('')
      return
    }

    let cancelled = false
    const loadReceiptData = async () => {
      setIsLoadingReceipt(true)
      setLoadError(null)
      try {
        // One loan fetch → base ReceiptData + per-object options; object + Avtals-ID
        // are chosen here and merged into the PDF at print time.
        const { receiptData: data, objectOptions: options } =
          await prepareReceipt({ receiptId, loanId })
        if (cancelled) return
        setReceiptData(data)
        setObjectOptions(options)
        // Auto-select when there's a single object, and its single lease.
        const onlyObject = options.length === 1 ? options[0] : undefined
        setSelectedObjectId(onlyObject?.rentalPropertyId ?? '')
        setLeaseDisplayId(
          onlyObject?.matches.length === 1 ? onlyObject.matches[0].leaseId : ''
        )
      } catch (err) {
        console.error('Failed to fetch receipt data:', err)
        if (!cancelled) {
          setReceiptData(null)
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Kunde inte skapa kvittensen. Kontrollera lånets kontakt.'
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReceipt(false)
        }
      }
    }

    loadReceiptData()

    return () => {
      cancelled = true
    }
  }, [isOpen, isMaintenance, props])

  // Reset comment when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setComment('')
    }
  }, [isOpen])

  // The chosen object and its candidate leases drive the Avtal step + print merge.
  const selectedObject = objectOptions.find(
    (o) => o.rentalPropertyId === selectedObjectId
  )
  const leaseMatches = selectedObject?.matches ?? []

  // ---------- PRINT ----------
  const handleOpenPdfTab = async () => {
    if (isMaintenance) {
      const { loanId } = props as MaintenanceReceiptProps
      if (!loanId) return
      setIsPrinting(true)
      try {
        await openMaintenanceReceiptInNewTab(loanId, addSignature(comment))
      } finally {
        setIsPrinting(false)
      }
    } else {
      if (!receiptData) return
      const dataWithContract = {
        ...receiptData,
        rentalPropertyId: selectedObject?.rentalPropertyId,
        address: selectedObject?.address ?? null,
        leaseDisplayId: leaseDisplayId.trim() || undefined,
        comment: addSignature(comment),
      }
      await openPdfInNewTab(dataWithContract)
    }
  }

  // ---------- TEXT ----------
  const isReprint = !isMaintenance && !(props as TenantReceiptProps).receiptId

  const actionText = isReprint
    ? 'Skriv ut lånkvittens'
    : isMaintenance
      ? 'Nycklar utlånade'
      : receiptData?.receiptType === 'LOAN'
        ? 'Nycklar utlånade'
        : 'Nycklar återlämnade'

  const signerLabel = isMaintenance ? 'entreprenören' : 'hyresgästen'

  const descriptionText = isReprint
    ? `Skriv ut kvittensen och låt ${signerLabel} signera.`
    : isMaintenance
      ? `En utlåningskvittens har skapats. Skriv ut och låt ${signerLabel} signera.`
      : receiptData?.receiptType === 'LOAN'
        ? `En utlåningskvittens har skapats. Skriv ut och låt ${signerLabel} signera.`
        : 'En återlämningskvittens har skapats. Du kan skriva ut den.'

  const isLoanReceipt = isMaintenance || receiptData?.receiptType === 'LOAN'

  // Don't show dialog for return receipts - they're auto-generated for records only
  if (!isMaintenance && receiptData?.receiptType === 'RETURN') {
    return null
  }

  // >1 object → must pick an object first; then >1 lease on it → must pick a lease.
  const needsObjectPick =
    !isMaintenance && objectOptions.length > 1 && !selectedObject
  const needsLeasePick =
    !isMaintenance &&
    leaseMatches.length > 1 &&
    !leaseMatches.some((l) => l.leaseId === leaseDisplayId)

  // For maintenance mode: ready to print immediately (no data fetching needed)
  // For tenant mode: ready when data is loaded and object + lease are settled
  const canPrint = isMaintenance
    ? !!(props as MaintenanceReceiptProps).loanId && !isPrinting
    : !!receiptData &&
      !isLoadingReceipt &&
      !loadError &&
      !needsObjectPick &&
      !needsLeasePick

  const isLoading = isMaintenance ? isPrinting : isLoadingReceipt

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isReprint ? actionText : `${actionText} framgångsrikt`}
          </DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Blocking error: borrower couldn't be resolved from the loan */}
          {!isMaintenance && loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {/* Warning about signature for LOAN receipts */}
          {isLoanReceipt && !loadError && (
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

          {/* Pick which rental object when the loan's keys span several */}
          {!isMaintenance &&
            !loadError &&
            receiptData &&
            objectOptions.length > 1 && (
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
                        onChange={() => {
                          setSelectedObjectId(o.rentalPropertyId)
                          setLeaseDisplayId(
                            o.matches.length === 1 ? o.matches[0].leaseId : ''
                          )
                        }}
                      />
                      <span className="tabular-nums">{o.rentalPropertyId}</span>
                      {o.address && (
                        <span className="text-muted-foreground">
                          {o.address}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

          {/* Pick which contract when several match the loan's contact */}
          {!isMaintenance && !loadError && receiptData && leaseMatches.length > 1 && (
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
                      onChange={() => setLeaseDisplayId(l.leaseId)}
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
          {!isMaintenance &&
            !loadError &&
            receiptData &&
            !needsObjectPick &&
            leaseMatches.length === 0 && (
              <div className="space-y-1">
                <label htmlFor="manual-lease-id" className="text-sm font-medium">
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
                  onChange={(e) => setLeaseDisplayId(e.target.value)}
                  placeholder="t.ex. 123-456-78/9"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}

          {/* Comment input */}
          <CommentInput
            value={comment}
            onChange={setComment}
            placeholder="Lägg till en kommentar på kvittensen..."
          />

          {/* Print (opens the real PDF and auto-opens print dialog) */}
          <Button
            onClick={handleOpenPdfTab}
            className="gap-2 w-full"
            disabled={!canPrint}
          >
            <Printer className="h-4 w-4" />
            {isLoading ? 'Laddar kvittens...' : 'Skriv ut kvittens'}
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
