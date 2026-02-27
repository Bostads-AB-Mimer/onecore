import { useState, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  User,
  AlertTriangle,
  ChevronDown,
  Info,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/v2/Badge'
import { cn } from '@/lib/utils'

const MAX_SMS_LENGTH = 1600
const COST_WARNING_THRESHOLD = 100
const SMS_COST_SEK = 0.5

function hasPhoneNumber(phone: string | null): boolean {
  return phone !== null && phone.trim().length > 0
}

export interface SmsRecipient {
  id: string
  name: string
  phone: string | null
}

interface BulkSmsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipients: SmsRecipient[]
  totalSelectedItems?: number
  onSend?: (message: string, recipients: SmsRecipient[]) => Promise<void>
}

export function BulkSmsModal({
  open,
  onOpenChange,
  recipients,
  totalSelectedItems,
  onSend,
}: BulkSmsModalProps) {
  const [message, setMessage] = useState('')
  const [showCostConfirmation, setShowCostConfirmation] = useState(false)
  const [showAllInvalid, setShowAllInvalid] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const charactersLeft = MAX_SMS_LENGTH - message.length

  const { validRecipients, invalidRecipients } = useMemo(() => {
    const valid = recipients.filter((r) => hasPhoneNumber(r.phone))
    const invalid = recipients.filter((r) => !hasPhoneNumber(r.phone))
    return { validRecipients: valid, invalidRecipients: invalid }
  }, [recipients])

  const estimatedCost = validRecipients.length * SMS_COST_SEK
  const duplicatesRemoved =
    totalSelectedItems != null && totalSelectedItems > recipients.length
      ? totalSelectedItems - recipients.length
      : 0

  const doSend = useCallback(async () => {
    if (!onSend || isSending) return
    setIsSending(true)
    try {
      await onSend(message, validRecipients)
      setMessage('')
      setShowCostConfirmation(false)
    } finally {
      setIsSending(false)
    }
  }, [onSend, isSending, message, validRecipients])

  const handleSend = () => {
    if (!message.trim() || validRecipients.length === 0) return

    // Show cost confirmation for large sends
    if (
      validRecipients.length > COST_WARNING_THRESHOLD &&
      !showCostConfirmation
    ) {
      setShowCostConfirmation(true)
      return
    }

    doSend()
  }

  const handleConfirmSend = () => {
    doSend()
  }

  const handleCancelConfirmation = () => {
    setShowCostConfirmation(false)
  }

  const handleClose = () => {
    setMessage('')
    setShowCostConfirmation(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Skicka SMS
          </DialogTitle>
          <DialogDescription>
            {totalSelectedItems != null &&
            totalSelectedItems !== recipients.length
              ? `${totalSelectedItems} valda hyreskontrakt \u2192 ${recipients.length} unika kontakter`
              : `Skicka SMS till ${validRecipients.length} av ${recipients.length} valda kunder`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Mottagare ({validRecipients.length})
            </label>
            <div className="mt-2 flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md bg-muted/30">
              {validRecipients.map((recipient) => (
                <Badge
                  key={recipient.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <User className="h-3 w-3" />
                  {recipient.name}
                </Badge>
              ))}
            </div>
          </div>

          {(duplicatesRemoved > 0 || invalidRecipients.length > 0) && (
            <div className="space-y-2">
              {duplicatesRemoved > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    {duplicatesRemoved} kontakter förekommer på flera kontrakt
                    och visas bara en gång
                  </span>
                </div>
              )}

              {invalidRecipients.length > 0 && (
                <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
                  <button
                    type="button"
                    className="flex items-start gap-2 w-full text-left"
                    onClick={() => setShowAllInvalid((prev) => !prev)}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="text-sm font-medium flex-1">
                      {invalidRecipients.length} mottagare saknar telefonnummer
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0 transition-transform',
                        showAllInvalid && 'rotate-180'
                      )}
                    />
                  </button>
                  {showAllInvalid && (
                    <div className="mt-2 ml-6 text-sm space-y-1 max-h-32 overflow-y-auto">
                      {invalidRecipients.map((r) => (
                        <div key={r.id} className="flex justify-between gap-2">
                          <span>{r.name}</span>
                          <span className="text-yellow-600 shrink-0">
                            {r.phone || 'Saknar nummer'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {validRecipients.length > COST_WARNING_THRESHOLD && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                Beräknad kostnad:{' '}
                <span className="font-medium">
                  {estimatedCost.toLocaleString('sv-SE', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kr
                </span>{' '}
                ({validRecipients.length} mottagare &times; {SMS_COST_SEK} kr)
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Meddelande</label>
              <span
                className={cn(
                  'text-sm',
                  charactersLeft < 20
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {charactersLeft} tecken kvar
              </span>
            </div>
            <Textarea
              placeholder="Skriv ditt SMS-meddelande här..."
              value={message}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, MAX_SMS_LENGTH))
              }
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>

        {showCostConfirmation ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-md bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-amber-800">Bekräfta utskick</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Vill du verkligen meddela{' '}
                  {validRecipients.length.toLocaleString('sv-SE')} kontakter?
                  Detta kommer kosta{' '}
                  {estimatedCost.toLocaleString('sv-SE', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  kronor.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancelConfirmation}
                disabled={isSending}
              >
                Avbryt
              </Button>
              <Button onClick={handleConfirmSend} disabled={isSending}>
                {isSending ? 'Skickar...' : 'Ja, skicka SMS'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                !message.trim() || validRecipients.length === 0 || isSending
              }
            >
              {isSending
                ? 'Skickar...'
                : `Skicka till ${validRecipients.length} mottagare`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
