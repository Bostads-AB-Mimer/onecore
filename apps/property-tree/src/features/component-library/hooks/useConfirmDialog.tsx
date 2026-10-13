import { useCallback, useRef, useState } from 'react'

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
import { buttonVariants } from '@/shared/ui/Button'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>

export const useConfirmDialog = () => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<(confirmed: boolean) => void>()

  const confirm = useCallback<Confirm>(
    (next) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve
        setOptions(next)
      }),
    []
  )

  const settle = (confirmed: boolean) => {
    resolveRef.current?.(confirmed)
    resolveRef.current = undefined
    setOptions(null)
  }

  const dialog = (
    <AlertDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <AlertDialogContent
        {...(options?.description ? {} : { 'aria-describedby': undefined })}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description && (
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {options?.cancelLabel ?? 'Avbryt'}
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, dialog }
}
