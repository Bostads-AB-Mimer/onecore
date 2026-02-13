import { useState, useMemo, useCallback } from 'react'
import { Mail, User, AlertTriangle } from 'lucide-react'
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
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/v2/Badge'
import { Label } from '@/components/ui/Label'

export interface EmailRecipient {
  id: string
  name: string
  email: string | null
}

interface BulkEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipients: EmailRecipient[]
  onSend?: (subject: string, body: string, recipients: EmailRecipient[]) => Promise<void>
}

export function BulkEmailModal({
  open,
  onOpenChange,
  recipients,
  onSend,
}: BulkEmailModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  const { validRecipients, invalidRecipients } = useMemo(() => {
    const valid = recipients.filter((r) => r.email)
    const invalid = recipients.filter((r) => !r.email)
    return { validRecipients: valid, invalidRecipients: invalid }
  }, [recipients])

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim() || validRecipients.length === 0) return
    if (!onSend || isSending) return
    setIsSending(true)
    try {
      await onSend(subject, body, validRecipients)
      setSubject('')
      setBody('')
    } finally {
      setIsSending(false)
    }
  }, [onSend, isSending, subject, body, validRecipients])

  const handleClose = () => {
    setSubject('')
    setBody('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Skicka mejl
          </DialogTitle>
          <DialogDescription>
            Skicka mejl till {validRecipients.length} av {recipients.length}{' '}
            valda kunder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              Mottagare ({validRecipients.length})
            </Label>
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
                  {invalidRecipients.length} mottagare saknar e-postadress:
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
            <Label htmlFor="email-subject" className="text-sm font-medium">
              Ämne
            </Label>
            <Input
              id="email-subject"
              placeholder="Skriv ämnesrad..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="email-body" className="text-sm font-medium">
              Meddelande
            </Label>
            <Textarea
              id="email-body"
              placeholder="Skriv ditt meddelande här..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-2 min-h-[150px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Avbryt
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              !subject.trim() || !body.trim() || validRecipients.length === 0 || isSending
            }
          >
            {isSending ? 'Skickar...' : `Skicka till ${validRecipients.length} mottagare`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
