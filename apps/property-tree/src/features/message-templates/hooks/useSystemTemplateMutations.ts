import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  SYSTEM_TEMPLATES_QUERY_KEY,
  type SystemTemplateKey,
} from '@/entities/system-template'

import {
  systemTemplateService,
  type UpdateSystemTemplate,
} from '@/services/api/core/systemTemplateService'

import { toast } from '@/shared/hooks/useToast'

import { failToast } from '../lib/failToast'

export function useUpdateSystemTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      body,
    }: {
      key: SystemTemplateKey
      body: UpdateSystemTemplate
    }) => systemTemplateService.update(key, body),
    onSuccess: () => {
      toast({ title: 'Mejlet sparades och används från nu' })
      return queryClient.invalidateQueries({
        queryKey: [SYSTEM_TEMPLATES_QUERY_KEY],
      })
    },
    onError: (error) => failToast('Kunde inte spara mejlet', error),
  })
}
