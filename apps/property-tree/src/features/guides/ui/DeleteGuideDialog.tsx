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

interface DeleteGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  isDeleting: boolean
  onConfirm: () => void
}

export function DeleteGuideDialog({
  open,
  onOpenChange,
  title,
  isDeleting,
  onConfirm,
}: DeleteGuideDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort guiden?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{title}&quot; tas bort med alla steg och bilder. Länkar till
            guiden slutar fungera. Det går inte att ångra.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Tar bort...' : 'Ta bort guiden'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
