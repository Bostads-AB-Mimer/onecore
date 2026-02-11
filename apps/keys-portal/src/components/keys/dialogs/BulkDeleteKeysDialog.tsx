import { useState, useEffect } from 'react'
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
import { buttonVariants } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Key } from '@/services/types'

interface BulkDeleteKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKeys: Key[]
  keysWithActiveLoans: Key[]
  onConfirm: () => Promise<void>
}

export function BulkDeleteKeysDialog({
  open,
  onOpenChange,
  selectedKeys,
  keysWithActiveLoans,
  onConfirm,
}: BulkDeleteKeysDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const hasBlockingKeys = keysWithActiveLoans.length > 0
  const deletableCount = selectedKeys.length - keysWithActiveLoans.length

  const handleConfirm = async () => {
    if (hasBlockingKeys) {
      return
    }

    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
    }
  }

  if (hasBlockingKeys) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Kan inte ta bort nycklar
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {keysWithActiveLoans.length === 1
                    ? '1 nyckel har ett aktivt lån och kan inte tas bort:'
                    : `${keysWithActiveLoans.length} nycklar har aktiva lån och kan inte tas bort:`}
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm max-h-[200px] overflow-y-auto">
                  {keysWithActiveLoans.slice(0, 10).map((key) => (
                    <li key={key.id}>{key.keyName}</li>
                  ))}
                  {keysWithActiveLoans.length > 10 && (
                    <li className="text-muted-foreground">
                      ...och {keysWithActiveLoans.length - 10} till
                    </li>
                  )}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Återlämna nycklarna först innan de kan tas bort.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stäng</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Ta bort {selectedKeys.length} nycklar?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Denna åtgärd kan inte ångras. Nycklarna kommer att tas bort
            permanent från systemet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={buttonVariants({ variant: 'destructive' })}
            disabled={isLoading}
          >
            {isLoading && <Spinner size="sm" className="mr-2" />}
            Ta bort {selectedKeys.length} nycklar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
