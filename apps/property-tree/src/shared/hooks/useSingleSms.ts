import { useCallback, useState } from 'react'

import { useToast } from './useToast'

interface SingleSmsState {
  open: boolean
  recipientName: string
  phoneNumber: string
  kundId?: string
}

interface UseSingleSmsOptions {
  sendSms: (
    recipients: { kundId?: string; phoneNumber: string }[],
    message: string
  ) => Promise<{ totalSent: number; totalInvalid: number }>
}

export function useSingleSms({ sendSms }: UseSingleSmsOptions) {
  const { toast } = useToast()
  const [state, setState] = useState<SingleSmsState>({
    open: false,
    recipientName: '',
    phoneNumber: '',
  })

  const openSmsModal = useCallback(
    (recipientName: string, phoneNumber: string, kundId?: string) => {
      setState({ open: true, recipientName, phoneNumber, kundId })
    },
    []
  )

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setState((prev) => ({ ...prev, open: false }))
    }
  }, [])

  const handleSendSms = useCallback(
    async (message: string) => {
      try {
        const result = await sendSms(
          [{ kundId: state.kundId, phoneNumber: state.phoneNumber }],
          message
        )

        toast({
          title: 'SMS skickat',
          description: `Skickades till ${result.totalSent} mottagare${
            result.totalInvalid > 0
              ? `. ${result.totalInvalid} ogiltiga nummer.`
              : ''
          }`,
        })

        setState((prev) => ({ ...prev, open: false }))
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        toast({
          title: 'Kunde inte skicka SMS',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    },
    [state.phoneNumber, state.kundId, sendSms, toast]
  )

  return {
    smsModalOpen: state.open,
    smsRecipientName: state.recipientName,
    smsPhoneNumber: state.phoneNumber,
    openSmsModal,
    onOpenChange,
    handleSendSms,
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const apiError = error as { message?: string; reason?: string }
    if (apiError.message) return apiError.message
    if (apiError.reason) return apiError.reason
  }
  return 'Ett fel uppstod'
}
