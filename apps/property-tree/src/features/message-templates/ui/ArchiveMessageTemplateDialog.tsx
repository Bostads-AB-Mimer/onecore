import type { MessageTemplate } from '@/entities/message-template'

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

import { useArchiveMessageTemplate } from '../hooks/useMessageTemplateMutations'

interface ArchiveMessageTemplateDialogProps {
  // When set, the dialog is open and targets this template. Null = closed.
  template: MessageTemplate | null
  onOpenChange: (open: boolean) => void
}

export function ArchiveMessageTemplateDialog({
  template,
  onOpenChange,
}: ArchiveMessageTemplateDialogProps) {
  const mutation = useArchiveMessageTemplate()

  return (
    <AlertDialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arkivera mall?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{template?.name}&quot; försvinner från mallvalet i
            SMS-dialogen. Skickade meddelanden påverkas inte, och mallen kan
            återställas från listan över arkiverade mallar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              if (!template) return
              mutation.mutate(template.id, {
                onSettled: () => onOpenChange(false),
              })
            }}
          >
            {mutation.isPending ? 'Arkiverar...' : 'Arkivera'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
