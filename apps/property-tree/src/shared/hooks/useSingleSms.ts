import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useToast } from './useToast'

// A fully-resolved SMS recipient. Having one is the proof we can send: every
// field is required, so there is no path to the API without a contactCode and
// phone number, and no empty-string placeholders to accidentally send.
export interface SingleSmsRecipient {
  name: string
  phoneNumber: string
  contactCode: string
}

interface UseSingleSmsOptions {
  sendSms: (
    recipients: { contactCode: string; phoneNumber: string }[],
    message: string
  ) => Promise<{ totalSent: number; totalInvalid: number }>
}

export function useSingleSms({ sendSms }: UseSingleSmsOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Selection is modal openness: null = closed, a recipient = open. There is
  // never a half-filled "open but blank" object.
  const [recipient, setRecipient] = useState<SingleSmsRecipient | null>(null)

  const sendMutation = useMutation({
    mutationFn: ({
      recipient,
      message,
    }: {
      recipient: SingleSmsRecipient
      message: string
    }) =>
      sendSms(
        [
          {
            contactCode: recipient.contactCode,
            phoneNumber: recipient.phoneNumber,
          },
        ],
        message
      ),
    onSuccess: (result) => {
      // Refresh any open tenant communication log so the new message appears.
      queryClient.invalidateQueries({ queryKey: ['tenant-communication'] })
      toast({
        title: 'SMS skickat',
        description: `Skickades till ${result.totalSent} mottagare${
          result.totalInvalid > 0
            ? `. ${result.totalInvalid} ogiltiga nummer.`
            : ''
        }`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Kunde inte skicka SMS',
        description: extractErrorMessage(error),
        variant: 'destructive',
      })
    },
  })

  const openSmsModal = useCallback(
    (r: SingleSmsRecipient) => setRecipient(r),
    []
  )
  const closeSms = useCallback(() => setRecipient(null), [])

  const handleSendSms = useCallback(
    async (message: string) => {
      if (!recipient) return
      try {
        await sendMutation.mutateAsync({ recipient, message })
      } catch {
        // Surfaced via onError; swallow so the modal doesn't see a rejection.
      }
    },
    [recipient, sendMutation]
  )

  return {
    recipient,
    openSmsModal,
    closeSms,
    handleSendSms,
    isSending: sendMutation.isPending,
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
