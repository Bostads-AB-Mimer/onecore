import { useRef } from 'react'
import type { Blocker } from 'react-router-dom'

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

interface LeavePageDialogProps {
  /** The blocker returned by `useLeavePageGuard`. */
  blocker: Blocker
  title: string
  description: string
}

/** Confirms a navigation blocked by `useLeavePageGuard`. */
export function LeavePageDialog({
  blocker,
  title,
  description,
}: LeavePageDialogProps) {
  // Set while "Lämna sidan" closes the dialog.
  const proceedingNavigation = useRef(false)

  return (
    <AlertDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        // Escape and outside clicks close the dialog without hitting a
        // button, so the blocker has to be released here too. Radix also
        // closes on "Lämna sidan", where the blocker is already proceeding.
        if (open) return
        if (proceedingNavigation.current) {
          proceedingNavigation.current = false
          return
        }
        blocker.reset?.()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stanna kvar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              proceedingNavigation.current = true
              blocker.proceed?.()
            }}
          >
            Lämna sidan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
