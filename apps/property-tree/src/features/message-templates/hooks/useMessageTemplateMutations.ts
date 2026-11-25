import { toast } from '@onecore/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  type CreateMessageTemplate,
  MESSAGE_TEMPLATES_QUERY_KEY,
  type UpdateMessageTemplate,
} from '@/entities/message-template'

import { messageTemplateService } from '@/services/api/core/messageTemplateService'

import { errorCodeOf, templateErrorText } from '@/shared/lib/templateErrorText'

function useInvalidateMessageTemplates() {
  const queryClient = useQueryClient()
  // Every status filter shows the changed row somewhere (active <-> archived).
  return () =>
    queryClient.invalidateQueries({ queryKey: [MESSAGE_TEMPLATES_QUERY_KEY] })
}

const failToast = (title: string, error: unknown) =>
  toast({
    title,
    description: templateErrorText(errorCodeOf(error)) ?? undefined,
    variant: 'destructive',
  })

export function useCreateMessageTemplate() {
  const invalidate = useInvalidateMessageTemplates()
  return useMutation({
    mutationFn: (body: CreateMessageTemplate) =>
      messageTemplateService.create(body),
    onSuccess: () => {
      toast({ title: 'Mallen skapades' })
      return invalidate()
    },
    onError: (error) => failToast('Kunde inte skapa mallen', error),
  })
}

export function useUpdateMessageTemplate() {
  const invalidate = useInvalidateMessageTemplates()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMessageTemplate }) =>
      messageTemplateService.update(id, body),
    onSuccess: () => {
      toast({ title: 'Mallen uppdaterades' })
      return invalidate()
    },
    onError: (error) => failToast('Kunde inte uppdatera mallen', error),
  })
}

export function useArchiveMessageTemplate() {
  const invalidate = useInvalidateMessageTemplates()
  return useMutation({
    mutationFn: (id: string) => messageTemplateService.archive(id),
    onSuccess: () => {
      toast({ title: 'Mallen arkiverades' })
      return invalidate()
    },
    onError: (error) => failToast('Kunde inte arkivera mallen', error),
  })
}

export function useRestoreMessageTemplate() {
  const invalidate = useInvalidateMessageTemplates()
  return useMutation({
    mutationFn: (id: string) => messageTemplateService.restore(id),
    onSuccess: () => {
      toast({ title: 'Mallen återställdes' })
      return invalidate()
    },
    onError: (error) => failToast('Kunde inte återställa mallen', error),
  })
}
