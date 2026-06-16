import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useToast } from './useToast'

interface SingleEmailState {
  open: boolean
  recipientName: string
  emailAddress: string
  kundId?: string
}

interface UseSingleEmailOptions {
  sendEmail: (
    recipients: { kundId?: string; emailAddress: string }[],
    subject: string,
    text: string
  ) => Promise<{ totalSent: number; totalInvalid: number }>
}

export function useSingleEmail({ sendEmail }: UseSingleEmailOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SingleEmailState>({
    open: false,
    recipientName: '',
    emailAddress: '',
  })

  const openEmailModal = useCallback(
    (recipientName: string, emailAddress: string, kundId?: string) => {
      setState({ open: true, recipientName, emailAddress, kundId })
    },
    []
  )

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setState((prev) => ({ ...prev, open: false }))
    }
  }, [])

  const handleSendEmail = useCallback(
    async (subject: string, body: string) => {
      try {
        const result = await sendEmail(
          [{ kundId: state.kundId, emailAddress: state.emailAddress }],
          subject,
          body
        )

        // Refresh any open tenant communication log so the new message appears.
        queryClient.invalidateQueries({ queryKey: ['tenant-communication'] })

        toast({
          title: 'Mejl skickat',
          description: `Skickades till ${result.totalSent} mottagare${
            result.totalInvalid > 0
              ? `. ${result.totalInvalid} ogiltiga adresser.`
              : ''
          }`,
        })

        setState((prev) => ({ ...prev, open: false }))
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        toast({
          title: 'Kunde inte skicka mejl',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    },
    [state.emailAddress, state.kundId, sendEmail, toast, queryClient]
  )

  return {
    emailModalOpen: state.open,
    emailRecipientName: state.recipientName,
    emailAddress: state.emailAddress,
    openEmailModal,
    onOpenChange,
    handleSendEmail,
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
