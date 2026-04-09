import { useCallback, useState } from 'react'

import { tenantService } from '@/services/api/core/tenantService'

import { useToast } from './useToast'

interface SingleSmsState {
  open: boolean
  recipientName: string
  phoneNumber: string
}

export function useSingleSms() {
  const { toast } = useToast()
  const [state, setState] = useState<SingleSmsState>({
    open: false,
    recipientName: '',
    phoneNumber: '',
  })

  const openSmsModal = useCallback(
    (recipientName: string, phoneNumber: string) => {
      setState({ open: true, recipientName, phoneNumber })
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
        const result = await tenantService.sendBulkSms(
          [state.phoneNumber],
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
    [state.phoneNumber, toast]
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
