import { useRef, useState } from 'react'
import { Braces } from 'lucide-react'

import type { TemplatePlaceholder } from '@/entities/system-template'

import { formatTimestamp } from '@/shared/lib/formatters'
import { errorCodeOf, templateErrorText } from '@/shared/lib/templateErrorText'
import { cn } from '@/shared/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/AlertDialog'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import { useLatestTemplate } from '../hooks/useLatestTemplate'
import {
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
} from '../hooks/useMessageTemplateMutations'
import { useUpdateSystemTemplate } from '../hooks/useSystemTemplateMutations'
import {
  useSmsTextPreview,
  useSystemEmailPreview,
} from '../hooks/useTemplatePreview'
import type { TemplateEditTarget } from '../lib/editTarget'
import { placeholderText } from '../lib/editor/placeholderMark'
import { TemplateEditor } from './TemplateEditor'

// Same cap as the SMS modal, so a template never exceeds what can be sent.
const MAX_SMS_LENGTH = 1600
const MAX_NAME_LENGTH = 255

interface MessageTemplateFormDialogProps {
  target: TemplateEditTarget | null // null = closed
  onClose: () => void
}

/** One editor for every template; closing with unsaved changes asks first. */
export function MessageTemplateFormDialog({
  target,
  onClose,
}: MessageTemplateFormDialogProps) {
  // Unmounted while closed, so the form state is fresh on each open.
  return target ? (
    <TemplateFormDialog target={target} onClose={onClose} />
  ) : null
}

function TemplateFormDialog({
  target,
  onClose,
}: {
  target: TemplateEditTarget
  onClose: () => void
}) {
  const system = target.kind === 'system' ? target.template : null
  const sms = target.kind === 'sms' ? target.template : null
  const initialName = system?.name ?? sms?.name ?? ''
  const initialSubject = system?.subject ?? ''
  const placeholders = system?.placeholders ?? []

  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(system?.body ?? sms?.body ?? '')
  const [bodyTouched, setBodyTouched] = useState(false)
  const [tab, setTab] = useState('edit')
  const [conflictOpen, setConflictOpen] = useState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const subjectRef = useRef<HTMLInputElement>(null)
  const { latest, isError: latestFailed } = useLatestTemplate(
    target,
    conflictOpen
  )

  const createMutation = useCreateMessageTemplate()
  const updateMutation = useUpdateMessageTemplate()
  const updateSystemMutation = useUpdateSystemTemplate()
  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    updateSystemMutation.isPending

  const dirty =
    bodyTouched || name !== initialName || subject !== initialSubject

  const requestClose = () => {
    if (isSaving) return
    if (dirty) setConfirmCloseOpen(true)
    else onClose()
  }

  const smsPreview = useSmsTextPreview(body, target.kind === 'sms')
  const smsLength = smsPreview.data?.text.length
  const emailPreview = useSystemEmailPreview(
    system?.key ?? null,
    subject,
    body,
    tab === 'preview'
  )

  const canSave =
    body.trim() !== '' &&
    (system ? subject.trim() !== '' : name.trim() !== '') &&
    !(smsLength !== undefined && smsLength > MAX_SMS_LENGTH) &&
    !isSaving

  // mutate's own callbacks don't run once the form has unmounted.
  const save = (revision: number) => {
    const callbacks = {
      onSuccess: () => onClose(),
      onError: (error: unknown) => {
        // Someone else saved first: the warning shows who and lets the user choose.
        if (errorCodeOf(error) === 'TEMPLATE_CHANGED') setConflictOpen(true)
      },
    }
    if (system) {
      updateSystemMutation.mutate(
        { key: system.key, body: { subject: subject.trim(), body, revision } },
        callbacks
      )
    } else if (sms) {
      updateMutation.mutate(
        { id: sms.id, body: { name: name.trim(), body, revision } },
        callbacks
      )
    } else {
      createMutation.mutate({ name: name.trim(), body }, callbacks)
    }
  }

  const insertIntoSubject = (placeholder: TemplatePlaceholder) => {
    const input = subjectRef.current
    const at = input?.selectionStart ?? subject.length
    const end = input?.selectionEnd ?? at
    setSubject(
      subject.slice(0, at) +
        placeholderText(placeholder.token) +
        subject.slice(end)
    )
  }

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) save(system?.revision ?? sms?.revision ?? 1)
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {system ? system.name : sms ? 'Redigera SMS-mall' : 'Ny SMS-mall'}
            </DialogTitle>
            <DialogDescription>
              {system
                ? 'Ändringarna gäller från nästa mejl som skickas. Förhandsgranskningen visar mejlet med exempelvärden.'
                : 'Texten är en startpunkt: den som skickar kan ändra allt innan SMS:et går ut. Fetstil och knappar syns inte i ett SMS, förhandsgranska för att se texten.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="edit">Redigera</TabsTrigger>
              <TabsTrigger value="preview">Förhandsgranska</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-4">
              {system ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="template-subject">Ämnesrad</Label>
                    <SubjectPlaceholderMenu
                      placeholders={placeholders.filter(
                        (p) => p.kind === 'text'
                      )}
                      disabled={isSaving}
                      onSelect={insertIntoSubject}
                    />
                  </div>
                  <Input
                    id="template-subject"
                    ref={subjectRef}
                    value={subject}
                    maxLength={MAX_NAME_LENGTH}
                    disabled={isSaving}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="template-name">Namn</Label>
                  <Input
                    id="template-name"
                    value={name}
                    maxLength={MAX_NAME_LENGTH}
                    placeholder="T.ex. Nyckel klar för uthämtning"
                    disabled={isSaving}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label id="template-body-label">
                    {system ? 'Mejlet' : 'Text'}
                  </Label>
                  {!system && (
                    <SmsLength
                      length={smsLength}
                      failed={smsPreview.isError}
                      empty={body.trim() === ''}
                    />
                  )}
                </div>
                <TemplateEditor
                  value={body}
                  onChange={(markdown) => {
                    setBody(markdown)
                    setBodyTouched(true)
                  }}
                  placeholders={placeholders}
                  frame={
                    system
                      ? {
                          logoUrl: system.logoUrl,
                          footerLines: system.footerLines,
                        }
                      : undefined
                  }
                  disabled={isSaving}
                  ariaLabelledBy="template-body-label"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview">
              {system ? (
                <EmailPreview
                  isLoading={emailPreview.isLoading}
                  error={emailPreview.error}
                  subject={emailPreview.data?.subject}
                  html={emailPreview.data?.html}
                />
              ) : (
                <SmsPreview
                  text={smsPreview.data?.text}
                  error={smsPreview.error}
                  empty={body.trim() === ''}
                />
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isSaving}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={!canSave}>
              {isSaving ? 'Sparar...' : sms || system ? 'Spara' : 'Skapa mall'}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Någon annan har sparat mallen</AlertDialogTitle>
              <AlertDialogDescription>
                {latest
                  ? `${latest.updatedBy ?? 'Någon'} sparade mallen ${formatTimestamp(latest.updatedAt)} medan du redigerade. Sparar du ändå ersätts deras ändring av din, och den går inte att få tillbaka. `
                  : latestFailed
                    ? 'Den senaste versionen kunde inte hämtas, så du kan inte spara över den just nu. '
                    : 'Hämtar den senaste versionen... '}
                Avbryter du ligger din text kvar så att du kan kopiera den.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                disabled={!latest}
                onClick={() => {
                  if (latest) save(latest.revision)
                }}
              >
                Spara ändå
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Stäng utan att spara?</AlertDialogTitle>
              <AlertDialogDescription>
                Du har ändringar som inte är sparade. Stänger du försvinner de.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Fortsätt redigera</AlertDialogCancel>
              <AlertDialogAction onClick={onClose}>
                Stäng utan att spara
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}

function SubjectPlaceholderMenu({
  placeholders,
  disabled,
  onSelect,
}: {
  placeholders: TemplatePlaceholder[]
  disabled: boolean
  onSelect: (placeholder: TemplatePlaceholder) => void
}) {
  if (placeholders.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          disabled={disabled}
        >
          <Braces />
          Infoga
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {placeholders.map((p) => (
          <DropdownMenuItem key={p.token} onSelect={() => onSelect(p)}>
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SmsLength({
  length,
  failed,
  empty,
}: {
  length: number | undefined
  failed: boolean
  empty: boolean
}) {
  if (empty) return null
  if (failed) {
    return (
      <span className="text-sm text-muted-foreground">
        Längden kunde inte räknas
      </span>
    )
  }
  if (length === undefined) return null
  return (
    <span
      className={cn(
        'text-sm',
        length > MAX_SMS_LENGTH ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {length} / {MAX_SMS_LENGTH} tecken
    </span>
  )
}

function SmsPreview({
  text,
  error,
  empty,
}: {
  text: string | undefined
  error: unknown
  empty: boolean
}) {
  if (empty) {
    return <p className="text-sm text-muted-foreground">Mallen är tom.</p>
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {templateErrorText(errorCodeOf(error)) ??
          'SMS-texten kunde inte visas. Försök igen.'}
      </p>
    )
  }
  if (text === undefined) {
    return <p className="text-sm text-muted-foreground">Laddar...</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Så här blir SMS-texten:</p>
      <div className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-sm">
        {text}
      </div>
      <p
        className={cn(
          'text-sm',
          text.length > MAX_SMS_LENGTH
            ? 'text-destructive'
            : 'text-muted-foreground'
        )}
      >
        {text.length} / {MAX_SMS_LENGTH} tecken
      </p>
    </div>
  )
}

function EmailPreview({
  isLoading,
  error,
  subject,
  html,
}: {
  isLoading: boolean
  error: unknown
  subject: string | undefined
  html: string | undefined
}) {
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {templateErrorText(errorCodeOf(error)) ??
          'Förhandsgranskningen kunde inte visas. Försök igen.'}
      </p>
    )
  }
  if (isLoading || html === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Laddar förhandsgranskning...
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="text-muted-foreground">Ämne: </span>
        {subject}
      </p>
      {/* Empty sandbox: the rendered email runs no scripts and opens nothing. */}
      <iframe
        title="Förhandsgranskning av mejlet"
        sandbox=""
        srcDoc={html}
        className="h-[60vh] w-full rounded-md border bg-white"
      />
    </div>
  )
}
