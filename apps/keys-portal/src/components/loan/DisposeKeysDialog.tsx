import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { KeyWithStatus } from '@/utils/keyStatusHelpers'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKeys: KeyWithStatus[]
  onConfirm: () => void
}

export function DisposeKeysDialog({
  open,
  onOpenChange,
  selectedKeys,
  onConfirm,
}: Props) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kassera nycklar</AlertDialogTitle>
          <AlertDialogDescription>
            Är du säker på att du vill kassera följande nycklar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-4">
          <ul className="list-disc list-inside space-y-1">
            {selectedKeys.map((key) => (
              <li key={key.id}>
                {key.keyName}
                {key.keySequenceNumber && ` ${key.keySequenceNumber}`}
              </li>
            ))}
          </ul>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Kassera</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
