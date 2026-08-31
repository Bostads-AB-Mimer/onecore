import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useToast } from './useToast'

// A fully-resolved email recipient. Having one is the proof we can send: every
// field is required, so there is no path to the API without a contactCode and
// email address, and no empty-string placeholders to accidentally send.
export interface SingleEmailRecipient {
  name: string
  emailAddress: string
  contactCode: string
}

interface UseSingleEmailOptions {
  sendEmail: (
    recipients: { contactCode: string; emailAddress: string }[],
    subject: string,
    text: string
  ) => Promise<{
    content: { totalSent: number; totalInvalid: number }
    warnings?: string[]
  }>
}

export function useSingleEmail({ sendEmail }: UseSingleEmailOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Selection is modal openness: null = closed, a recipient = open. There is
  // never a half-filled "open but blank" object.
  const [recipient, setRecipient] = useState<SingleEmailRecipient | null>(null)

  const sendMutation = useMutation({
    mutationFn: ({
      recipient,
      subject,
      body,
    }: {
      recipient: SingleEmailRecipient
      subject: string
      body: string
    }) =>
      sendEmail(
        [
          {
            contactCode: recipient.contactCode,
            emailAddress: recipient.emailAddress,
          },
        ],
        subject,
        body
      ),
    onSuccess: (result) => {
      // Refresh any open tenant communication log so the new message appears.
      queryClient.invalidateQueries({ queryKey: ['tenant-communication'] })
      toast({
        title: 'Mejl skickat',
        description: `Skickades till ${result.content.totalSent} mottagare${
          result.content.totalInvalid > 0
            ? `. ${result.content.totalInvalid} ogiltiga adresser.`
            : ''
        }`,
      })

      // Non-blocking: the email was sent, but something like communication-log
      // writing failed. Surface it without blocking the success flow.
      if (result.warnings?.length) {
        toast({
          title: 'Mejlet skickades, men en åtgärd misslyckades',
          description: result.warnings.join(' '),
          variant: 'destructive',
        })
      }
    },
    onError: (error) => {
      toast({
        title: 'Kunde inte skicka mejl',
        description: extractErrorMessage(error),
        variant: 'destructive',
      })
    },
  })

  const openEmailModal = useCallback(
    (r: SingleEmailRecipient) => setRecipient(r),
    []
  )
  const closeEmail = useCallback(() => setRecipient(null), [])

  const handleSendEmail = useCallback(
    async (subject: string, body: string) => {
      if (!recipient) return
      try {
        await sendMutation.mutateAsync({ recipient, subject, body })
      } catch {
        // Surfaced via onError; swallow so the modal doesn't see a rejection.
      }
    },
    [recipient, sendMutation]
  )

  return {
    recipient,
    openEmailModal,
    closeEmail,
    handleSendEmail,
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
