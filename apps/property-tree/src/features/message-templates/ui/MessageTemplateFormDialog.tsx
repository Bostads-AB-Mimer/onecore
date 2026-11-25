import { useState } from 'react'

import type {
  CreateMessageTemplate,
  MessageTemplate,
} from '@/entities/message-template'

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
import { Textarea } from '@/shared/ui/Textarea'

import {
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
} from '../hooks/useMessageTemplateMutations'

// Same cap as the SMS modal, so a template never exceeds what can be sent.
const MAX_SMS_LENGTH = 1600
const MAX_NAME_LENGTH = 255

interface MessageTemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The template being edited. Null = create a new template.
  template: MessageTemplate | null
}

export function MessageTemplateFormDialog({
  open,
  onOpenChange,
  template,
}: MessageTemplateFormDialogProps) {
  const createMutation = useCreateMessageTemplate()
  const updateMutation = useUpdateMessageTemplate()
  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (body: CreateMessageTemplate) => {
    const onSuccess = () => onOpenChange(false)
    if (template) {
      updateMutation.mutate({ id: template.id, body }, { onSuccess })
    } else {
      createMutation.mutate(body, { onSuccess })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!isSaving) onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? 'Redigera mall' : 'Ny mall'}</DialogTitle>
          <DialogDescription>
            Texten är en startpunkt: den som skickar kan ändra allt innan SMS:et
            går ut.
          </DialogDescription>
        </DialogHeader>

        {/* Unmounted while closed, so the form state is fresh on each open. */}
        {open && (
          <MessageTemplateForm
            template={template}
            isSaving={isSaving}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface MessageTemplateFormProps {
  template: MessageTemplate | null
  isSaving: boolean
  onSubmit: (body: CreateMessageTemplate) => void
  onCancel: () => void
}

function MessageTemplateForm({
  template,
  isSaving,
  onSubmit,
  onCancel,
}: MessageTemplateFormProps) {
  const [name, setName] = useState(template?.name ?? '')
  const [body, setBody] = useState(template?.body ?? '')

  const charactersLeft = MAX_SMS_LENGTH - body.length
  const canSave = name.trim().length > 0 && body.trim().length > 0 && !isSaving

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        onSubmit({ name: name.trim(), body: body.trim() })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="template-name">Namn</Label>
        <Input
          id="template-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="T.ex. Nyckel klar för uthämtning"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="template-body">Text</Label>
          <span
            className={cn(
              'text-sm',
              charactersLeft < 20 ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {charactersLeft} tecken kvar
          </span>
        </div>
        <Textarea
          id="template-body"
          value={body}
          placeholder="Skriv mallens SMS-text här..."
          onChange={(e) => setBody(e.target.value.slice(0, MAX_SMS_LENGTH))}
          className="min-h-[140px] resize-none"
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Avbryt
        </Button>
        <Button type="submit" disabled={!canSave}>
          {isSaving ? 'Sparar...' : template ? 'Spara' : 'Skapa mall'}
        </Button>
      </DialogFooter>
    </form>
  )
}
