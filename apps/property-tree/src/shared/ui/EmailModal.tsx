import { useCallback, useMemo, useRef, useState } from 'react'
import type { EmailAttachment } from '@onecore/types'
import {
  AlertTriangle,
  ChevronDown,
  Info,
  Mail,
  Paperclip,
  User,
  X,
} from 'lucide-react'

import {
  addEmailAttachmentFiles,
  EMAIL_ATTACHMENT_ACCEPT,
  EMAIL_ATTACHMENT_LIMIT_TEXT,
  toEmailAttachments,
} from '@/shared/lib/emailAttachments'
import { formatFileSize } from '@/shared/lib/fileUtils'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/Badge'
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
  onSend: (
    subject: string,
    body: string,
    attachments: EmailAttachment[]
  ) => Promise<void>
  recipients?: undefined
  totalSelectedItems?: undefined
}

interface EmailModalBulkProps extends EmailModalBaseProps {
  recipients: EmailRecipient[]
  totalSelectedItems?: number
  onSend?: (
    subject: string,
    body: string,
    recipients: EmailRecipient[],
    attachments: EmailAttachment[]
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
  const [files, setFiles] = useState<File[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const recipients = props.recipients ?? []

  const { validRecipients, invalidRecipients } = useMemo(() => {
    if (!isBulk) return { validRecipients: [], invalidRecipients: [] }
    const valid = recipients.filter((r) => r.email)
    const invalid = recipients.filter((r) => !r.email)
    return { validRecipients: valid, invalidRecipients: invalid }
  }, [isBulk, recipients])

  const duplicatesRemoved =
    isBulk &&
    props.totalSelectedItems != null &&
    props.totalSelectedItems > recipients.length
      ? props.totalSelectedItems - recipients.length
      : 0

  const resetForm = () => {
    setSubject('')
    setBody('')
    setFiles([])
    setFileErrors([])
  }

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const result = addEmailAttachmentFiles(
      files,
      Array.from(e.target.files ?? [])
    )
    setFiles(result.files)
    setFileErrors(result.errors)
    // Allow picking the same file again after removing it.
    e.target.value = ''
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setFileErrors([])
  }

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim() || isSending) return

    if (isBulk) {
      if (validRecipients.length === 0 || !props.onSend) return

      setIsSending(true)
      try {
        const attachments = await toEmailAttachments(files)
        await (
          props.onSend as (
            subject: string,
            body: string,
            recipients: EmailRecipient[],
            attachments: EmailAttachment[]
          ) => Promise<void>
        )(subject, body, validRecipients, attachments)
        resetForm()
      } finally {
        setIsSending(false)
      }
    } else {
      setIsSending(true)
      try {
        const attachments = await toEmailAttachments(files)
        await (
          props.onSend as (
            subject: string,
            body: string,
            attachments: EmailAttachment[]
          ) => Promise<void>
        )(subject, body, attachments)
        resetForm()
        onOpenChange(false)
      } finally {
        setIsSending(false)
      }
    }
  }, [
    subject,
    body,
    files,
    isSending,
    isBulk,
    validRecipients,
    props.onSend,
    onOpenChange,
  ])

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const description = isBulk
    ? props.totalSelectedItems != null &&
      props.totalSelectedItems !== recipients.length
      ? `${props.totalSelectedItems} valda hyreskontrakt \u2192 ${recipients.length} unika kontakter`
      : `Skicka mejl till ${validRecipients.length} av ${recipients.length} valda kunder`
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

          <div>
            <Label className="text-sm font-medium">Bilagor</Label>
            <div className="mt-2 space-y-2">
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 px-2 py-1 border rounded-md bg-muted/30 text-sm"
                    >
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isSending}
                        aria-label={`Ta bort ${file.name}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={EMAIL_ATTACHMENT_ACCEPT}
                onChange={handleFilesSelected}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Bifoga fil
              </Button>
              <p className="text-xs text-muted-foreground">
                {EMAIL_ATTACHMENT_LIMIT_TEXT}
              </p>
              {fileErrors.length > 0 && (
                <div className="text-sm text-destructive space-y-1">
                  {fileErrors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              )}
              {isBulk && files.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    Samma bilagor skickas till alla {validRecipients.length}{' '}
                    mottagare
                  </span>
                </div>
              )}
            </div>
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
