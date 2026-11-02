import type { ReleaseNote } from '@/entities/release-note'

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

import { useDeleteReleaseNote } from '../hooks/useReleaseNoteMutations'

interface DeleteReleaseNoteDialogProps {
  // When set, the dialog is open and targets this note. Null = closed.
  note: ReleaseNote | null
  onOpenChange: (open: boolean) => void
}

export function DeleteReleaseNoteDialog({
  note,
  onOpenChange,
}: DeleteReleaseNoteDialogProps) {
  const mutation = useDeleteReleaseNote()

  return (
    <AlertDialog
      open={note !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort nyhet?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{note?.title}&quot; tas bort permanent. Det går inte att
            ångra.
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
              if (!note) return
              mutation.mutate(note.id, {
                onSettled: () => onOpenChange(false),
              })
            }}
          >
            {mutation.isPending ? 'Tar bort...' : 'Ta bort'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
