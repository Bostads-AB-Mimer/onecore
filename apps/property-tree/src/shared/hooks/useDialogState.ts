import { useCallback, useState } from 'react'

export interface DialogState<T> {
  isOpen: boolean
  mode: 'create' | 'edit'
  entity?: T
  defaultValues?: Record<string, unknown>
}

export interface UseDialogStateReturn<T> {
  state: DialogState<T>
  openCreate: (defaultValues?: Record<string, unknown>) => void
  openEdit: (entity: T) => void
  close: () => void
}

export function useDialogState<T>(): UseDialogStateReturn<T> {
  const [state, setState] = useState<DialogState<T>>({
    isOpen: false,
    mode: 'create',
  })

  const openCreate = useCallback((defaultValues?: Record<string, unknown>) => {
    setState({
      isOpen: true,
      mode: 'create',
      entity: undefined,
      defaultValues,
    })
  }, [])

  const openEdit = useCallback((entity: T) => {
    setState({
      isOpen: true,
      mode: 'edit',
      entity,
      defaultValues: undefined,
    })
  }, [])

  const close = useCallback(() => {
    setState({
      isOpen: false,
      mode: 'create',
      entity: undefined,
      defaultValues: undefined,
    })
  }, [])

  return { state, openCreate, openEdit, close }
}

/**
 * Simplified dialog state for view-only dialogs (no create/edit modes)
 * Use this for dialogs that just display entity details
 */
export interface SimpleDialogState<T> {
  isOpen: boolean
  data?: T
}

export interface UseSimpleDialogStateReturn<T> {
  state: SimpleDialogState<T>
  open: (data: T) => void
  close: () => void
}

export function useSimpleDialogState<T>(): UseSimpleDialogStateReturn<T> {
  const [state, setState] = useState<SimpleDialogState<T>>({
    isOpen: false,
  })

  const open = useCallback((data: T) => {
    setState({ isOpen: true, data })
  }, [])

  const close = useCallback(() => {
    setState({ isOpen: false, data: undefined })
  }, [])

  return { state, open, close }
}
