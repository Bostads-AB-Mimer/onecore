import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Info, Mail } from 'lucide-react'

import { useRemovableRecipients } from '@/shared/hooks/useRemovableRecipients'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { RecipientChipList } from '@/shared/ui/RecipientChipList'
import { Textarea } from '@/shared/ui/Textarea'

export interface EmailRecipient {
  id: string
  name: string
  email: string | null
}

interface EmailModalBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface EmailModalSingleProps extends EmailModalBaseProps {
  recipientName: string
  emailAddress: string
  onSend: (subject: string, body: string) => Promise<void>
  recipients?: undefined
  totalSelectedItems?: undefined
  excludedRecipientsCount?: undefined
}

interface EmailModalBulkProps extends EmailModalBaseProps {
  recipients: EmailRecipient[]
  totalSelectedItems?: number
  /** Contacts excluded by unchecking rows in the table (all-results mode) */
  excludedRecipientsCount?: number
  onSend?: (
    subject: string,
    body: string,
    recipients: EmailRecipient[]
  ) => Promise<void>
  recipientName?: undefined
  emailAddress?: undefined
}

type EmailModalProps = EmailModalSingleProps | EmailModalBulkProps

export function EmailModal(props: EmailModalProps) {
  const { open, onOpenChange } = props
  const isBulk = Array.isArray(props.recipients)

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showAllInvalid, setShowAllInvalid] = useState(false)

  // Single reset path for all per-session state, on both open and close.
  // Esc/overlay dismissal calls onOpenChange directly and bypasses
  // handleClose, so nothing may rely on handleClose for cleanup.
  // (useRemovableRecipients resets its removal state on `open` the same way.)
  useEffect(() => {
    setSubject('')
    setBody('')
    setShowAllInvalid(false)
  }, [open])

  const recipients = props.recipients ?? []

  const { activeRecipients, removedCount, removeRecipient } =
    useRemovableRecipients(recipients, open)

  const { validRecipients, invalidRecipients } = useMemo(() => {
    if (!isBulk) return { validRecipients: [], invalidRecipients: [] }
    const valid = activeRecipients.filter((r) => r.email)
    const invalid = activeRecipients.filter((r) => !r.email)
    return { validRecipients: valid, invalidRecipients: invalid }
  }, [isBulk, activeRecipients])

  const duplicatesRemoved =
    isBulk &&
    props.totalSelectedItems != null &&
    props.totalSelectedItems > recipients.length
      ? props.totalSelectedItems - recipients.length
      : 0

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim() || isSending) return

    if (isBulk) {
      if (validRecipients.length === 0 || !props.onSend) return

      setIsSending(true)
      try {
        await (
          props.onSend as (
            subject: string,
            body: string,
            recipients: EmailRecipient[]
          ) => Promise<void>
        )(subject, body, validRecipients)
        setSubject('')
        setBody('')
      } finally {
        setIsSending(false)
      }
    } else {
      setIsSending(true)
      try {
        await (
          props.onSend as (subject: string, body: string) => Promise<void>
        )(subject, body)
        setSubject('')
        setBody('')
        onOpenChange(false)
      } finally {
        setIsSending(false)
      }
    }
  }, [
    subject,
    body,
    isSending,
    isBulk,
    validRecipients,
    props.onSend,
    onOpenChange,
  ])

  const handleClose = () => {
    onOpenChange(false)
  }

  // Contacts excluded via table-row unchecking, shown so the header numbers
  // reconcile with the selected-contract count
  const excludedSuffix =
    isBulk && props.excludedRecipientsCount
      ? ` \u00b7 ${props.excludedRecipientsCount} ${
          props.excludedRecipientsCount === 1 ? 'exkluderad' : 'exkluderade'
        }`
      : ''

  // Deliberately based on the ORIGINAL recipient list: this line explains the
  // contracts\u2192contacts deduplication, which manual removals must not skew.
  // Removals are surfaced separately next to the "Mottagare" label.
  const description = isBulk
    ? (props.totalSelectedItems != null &&
      props.totalSelectedItems !== recipients.length
        ? `${props.totalSelectedItems} valda hyreskontrakt \u2192 ${recipients.length} unika kontakter`
        : `Skicka mejl till ${validRecipients.length} av ${recipients.length} valda kunder`) +
      excludedSuffix
    : `Till ${props.recipientName} (${props.emailAddress})`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Skicka mejl
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isBulk && (
            <>
              <div>
                <Label className="text-sm font-medium">
                  Mottagare ({validRecipients.length})
                  {removedCount > 0 && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {removedCount}{' '}
                      {removedCount === 1 ? 'borttagen' : 'borttagna'}
                    </span>
                  )}
                </Label>
                <RecipientChipList
                  recipients={validRecipients}
                  onRemove={removeRecipient}
                />
              </div>

              {(duplicatesRemoved > 0 || invalidRecipients.length > 0) && (
                <div className="space-y-2">
                  {duplicatesRemoved > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="text-sm">
                        {duplicatesRemoved} kontakter förekommer på flera
                        kontrakt och visas bara en gång
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
                          {invalidRecipients.length} mottagare saknar
                          e-postadress
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
                            <div key={r.id}>{r.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
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
              !subject.trim() ||
              !body.trim() ||
              (isBulk && validRecipients.length === 0) ||
              isSending
            }
          >
            {isSending
              ? 'Skickar...'
              : isBulk
                ? `Skicka till ${validRecipients.length} mottagare`
                : 'Skicka mejl'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
