import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  Info,
  MessageSquare,
  User,
} from 'lucide-react'

import {
  type MessageTemplate,
  useMessageTemplates,
} from '@/entities/message-template'

import { useScheduleField } from '@/shared/hooks/useScheduleField'
import { shouldConfirmTemplateReplace } from '@/shared/lib/smsTemplates'
import { cn } from '@/shared/lib/utils'
import { routes } from '@/shared/routes'
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
import { ScheduleField } from '@/shared/ui/ScheduleField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'

const MAX_SMS_LENGTH = 1600
const COST_WARNING_THRESHOLD = 100
const SMS_COST_SEK = 0.5
// Radix Select items cannot have an empty value, so "no template" is a sentinel.
const NO_TEMPLATE = 'none'

function hasPhoneNumber(phone: string | null): boolean {
  return phone !== null && phone.trim().length > 0
}

export interface SmsRecipient {
  id: string
  name: string
  phone: string | null
}

interface SmsModalBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SmsModalSingleProps extends SmsModalBaseProps {
  recipientName: string
  phoneNumber: string
  // sendAt (ISO instant) is set when the user chose to schedule the send.
  // templateId is the template the text started from, if any.
  onSend: (
    message: string,
    sendAt?: string,
    templateId?: string
  ) => Promise<void>
  recipients?: undefined
  totalSelectedItems?: undefined
}

interface SmsModalBulkProps extends SmsModalBaseProps {
  recipients: SmsRecipient[]
  totalSelectedItems?: number
  // sendAt (ISO instant) is set when the user chose to schedule the send.
  // templateId is the template the text started from, if any.
  onSend?: (
    message: string,
    recipients: SmsRecipient[],
    sendAt?: string,
    templateId?: string
  ) => Promise<void>
  recipientName?: undefined
  phoneNumber?: undefined
}

type SmsModalProps = SmsModalSingleProps | SmsModalBulkProps

export function SmsModal(props: SmsModalProps) {
  const { open, onOpenChange } = props
  const isBulk = Array.isArray(props.recipients)

  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showCostConfirmation, setShowCostConfirmation] = useState(false)
  const [showAllInvalid, setShowAllInvalid] = useState(false)
  const schedule = useScheduleField()

  // Template link stays set even if the rep rewrites the whole text: the
  // message still started from it. appliedTemplateBody lets switching
  // templates skip the confirm while the text is untouched.
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )
  const [appliedTemplateBody, setAppliedTemplateBody] = useState<string | null>(
    null
  )
  const [pendingTemplate, setPendingTemplate] =
    useState<MessageTemplate | null>(null)
  const templatesQuery = useMessageTemplates('active', {
    enabled: open,
    // "Hantera mallar" opens a new tab; refetch when the rep comes back.
    refetchOnWindowFocus: 'always',
  })
  const templates = templatesQuery.data ?? []

  const charactersLeft = MAX_SMS_LENGTH - message.length

  const recipients = props.recipients ?? []

  const { validRecipients, invalidRecipients } = useMemo(() => {
    if (!isBulk) return { validRecipients: [], invalidRecipients: [] }
    const valid = recipients.filter((r) => hasPhoneNumber(r.phone))
    const invalid = recipients.filter((r) => !hasPhoneNumber(r.phone))
    return { validRecipients: valid, invalidRecipients: invalid }
  }, [isBulk, recipients])

  const estimatedCost = validRecipients.length * SMS_COST_SEK
  const duplicatesRemoved =
    isBulk &&
    props.totalSelectedItems != null &&
    props.totalSelectedItems > recipients.length
      ? props.totalSelectedItems - recipients.length
      : 0

  const resetTemplate = useCallback(() => {
    setSelectedTemplateId(null)
    setAppliedTemplateBody(null)
    setPendingTemplate(null)
  }, [])

  const applyTemplate = useCallback((template: MessageTemplate) => {
    setMessage(template.body.slice(0, MAX_SMS_LENGTH))
    setSelectedTemplateId(template.id)
    setAppliedTemplateBody(template.body)
    setPendingTemplate(null)
  }, [])

  const handleTemplateChange = (value: string) => {
    if (value === NO_TEMPLATE) {
      // Drop the link but keep whatever text is in the box.
      resetTemplate()
      return
    }
    const template = templates.find((t) => t.id === value)
    if (!template) return
    if (shouldConfirmTemplateReplace(message, appliedTemplateBody)) {
      setPendingTemplate(template)
    } else {
      applyTemplate(template)
    }
  }

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return
    const templateId = selectedTemplateId ?? undefined

    if (isBulk) {
      if (validRecipients.length === 0 || !props.onSend) return
      if (schedule.isScheduling && schedule.error) return

      if (
        validRecipients.length > COST_WARNING_THRESHOLD &&
        !showCostConfirmation
      ) {
        setShowCostConfirmation(true)
        return
      }

      setIsSending(true)
      try {
        await (
          props.onSend as (
            message: string,
            recipients: SmsRecipient[],
            sendAt?: string,
            templateId?: string
          ) => Promise<void>
        )(message, validRecipients, schedule.sendAtIso(), templateId)
        setMessage('')
        setShowCostConfirmation(false)
        schedule.reset()
        resetTemplate()
      } finally {
        setIsSending(false)
      }
    } else {
      if (schedule.isScheduling && schedule.error) return
      setIsSending(true)
      try {
        await (
          props.onSend as (
            message: string,
            sendAt?: string,
            templateId?: string
          ) => Promise<void>
        )(message, schedule.sendAtIso(), templateId)
        setMessage('')
        schedule.reset()
        resetTemplate()
        onOpenChange(false)
      } finally {
        setIsSending(false)
      }
    }
  }, [
    message,
    isSending,
    isBulk,
    validRecipients,
    showCostConfirmation,
    schedule,
    selectedTemplateId,
    resetTemplate,
    props.onSend,
    onOpenChange,
  ])

  const handleClose = () => {
    setMessage('')
    setShowCostConfirmation(false)
    schedule.reset()
    resetTemplate()
    onOpenChange(false)
  }

  const description = isBulk
    ? props.totalSelectedItems != null &&
      props.totalSelectedItems !== recipients.length
      ? `${props.totalSelectedItems} valda hyreskontrakt → ${recipients.length} unika kontakter`
      : `Skicka SMS till ${validRecipients.length} av ${recipients.length} valda kunder`
    : `Till ${props.recipientName} (${props.phoneNumber})`

  const noTemplates = !templatesQuery.isLoading && templates.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Skicka SMS
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isBulk && (
            <>
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
                          telefonnummer
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
                            <div
                              key={r.id}
                              className="flex justify-between gap-2"
                            >
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
                    ({validRecipients.length} mottagare &times; {SMS_COST_SEK}{' '}
                    kr)
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="sms-template" className="text-sm font-medium">
                Mall
              </label>
              {/* New tab: navigating in-app would unmount the dialog and lose the draft. */}
              <Link
                to={routes.messageTemplates}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Hantera mallar
              </Link>
            </div>
            <Select
              value={pendingTemplate?.id ?? selectedTemplateId ?? NO_TEMPLATE}
              onValueChange={handleTemplateChange}
              disabled={isSending || noTemplates}
            >
              <SelectTrigger id="sms-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>Ingen mall</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {noTemplates && !templatesQuery.isError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Inga mallar ännu.
              </p>
            )}
            {templatesQuery.isError && (
              <p className="mt-1 text-xs text-destructive">
                Mallarna kunde inte hämtas. Du kan fortfarande skriva fritt.
              </p>
            )}
            {pendingTemplate && (
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                <span className="text-sm flex-1">
                  Ersätt texten med mallen &quot;{pendingTemplate.name}&quot;?
                </span>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingTemplate(null)}
                  >
                    Behåll texten
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => applyTemplate(pendingTemplate)}
                  >
                    Ersätt
                  </Button>
                </div>
              </div>
            )}
          </div>

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

          <ScheduleField id="sms-schedule" field={schedule} />
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
                onClick={() => setShowCostConfirmation(false)}
                disabled={isSending}
              >
                Avbryt
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending
                  ? schedule.isScheduling
                    ? 'Schemalägger...'
                    : 'Skickar...'
                  : schedule.isScheduling
                    ? 'Ja, schemalägg SMS'
                    : 'Ja, skicka SMS'}
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
                !message.trim() ||
                (isBulk && validRecipients.length === 0) ||
                (schedule.isScheduling && !!schedule.error) ||
                isSending
              }
            >
              {isSending
                ? schedule.isScheduling
                  ? 'Schemalägger...'
                  : 'Skickar...'
                : isBulk
                  ? schedule.isScheduling
                    ? `Schemalägg till ${validRecipients.length} mottagare`
                    : `Skicka till ${validRecipients.length} mottagare`
                  : schedule.isScheduling
                    ? 'Schemalägg SMS'
                    : 'Skicka SMS'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
