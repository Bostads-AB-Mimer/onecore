import { useState, useMemo } from 'react'
import { MessageSquare, User, AlertTriangle } from 'lucide-react'
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

const MAX_SMS_LENGTH = 160
const COST_WARNING_THRESHOLD = 100
const SMS_COST_SEK = 0.5

function isValidSwedishMobile(phone: string | null): boolean {
  if (!phone) return false
  const cleaned = phone.replace(/[\s-]/g, '')
  // Swedish mobile: 07XXXXXXXX, +467XXXXXXXX, 00467XXXXXXXX, or 467XXXXXXXX
  return /^(07\d{8}|\+467\d{8}|00467\d{8}|467\d{8})$/.test(cleaned)
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
  onSend?: (message: string, recipients: SmsRecipient[]) => void
}

export function BulkSmsModal({
  open,
  onOpenChange,
  recipients,
  onSend,
}: BulkSmsModalProps) {
  const [message, setMessage] = useState('')
  const [showCostConfirmation, setShowCostConfirmation] = useState(false)

  const charactersLeft = MAX_SMS_LENGTH - message.length

  const { validRecipients, invalidRecipients } = useMemo(() => {
    const valid = recipients.filter((r) => isValidSwedishMobile(r.phone))
    const invalid = recipients.filter((r) => !isValidSwedishMobile(r.phone))
    return { validRecipients: valid, invalidRecipients: invalid }
  }, [recipients])

  const estimatedCost = validRecipients.length * SMS_COST_SEK

  const handleSend = () => {
    if (!message.trim() || validRecipients.length === 0) return

    // Show cost confirmation for large sends
    if (validRecipients.length > COST_WARNING_THRESHOLD && !showCostConfirmation) {
      setShowCostConfirmation(true)
      return
    }

    onSend?.(message, validRecipients)
    setMessage('')
    setShowCostConfirmation(false)
    onOpenChange(false)
  }

  const handleConfirmSend = () => {
    onSend?.(message, validRecipients)
    setMessage('')
    setShowCostConfirmation(false)
    onOpenChange(false)
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
            Skicka SMS till {validRecipients.length} av {recipients.length} valda
            kunder
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

          {invalidRecipients.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium">
                  {invalidRecipients.length} mottagare saknar giltigt mobilnummer:
                </span>{' '}
                {invalidRecipients
                  .slice(0, 3)
                  .map((r) => r.name)
                  .join(', ')}
                {invalidRecipients.length > 3 &&
                  ` och ${invalidRecipients.length - 3} till`}
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
              <Button variant="outline" onClick={handleCancelConfirmation}>
                Avbryt
              </Button>
              <Button onClick={handleConfirmSend}>Ja, skicka SMS</Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Avbryt
            </Button>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || validRecipients.length === 0}
            >
              Skicka till {validRecipients.length} mottagare
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
