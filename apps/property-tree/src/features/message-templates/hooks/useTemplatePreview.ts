import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { SystemTemplateKey } from '@/entities/system-template'

import { messageTemplateService } from '@/services/api/core/messageTemplateService'
import { systemTemplateService } from '@/services/api/core/systemTemplateService'

import { useDebounce } from '@/shared/hooks/useDebounce'

/**
 * SMS text of an unsaved body, for the length counter and preview. Debounced
 * while typing; the last text stays on screen until the next one arrives.
 */
export function useSmsTextPreview(body: string, enabled: boolean) {
  const debounced = useDebounce(body.trim(), 400)
  return useQuery({
    queryKey: ['messageTemplatePreview', debounced],
    queryFn: () => messageTemplateService.preview(debounced),
    enabled: enabled && debounced !== '',
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  })
}

/** The finished email for an unsaved subject and body, with example values. */
export function useSystemEmailPreview(
  key: SystemTemplateKey | null, // null: not a system template, nothing to fetch
  subject: string,
  body: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['systemTemplatePreview', key, subject, body],
    queryFn: () =>
      key ? systemTemplateService.preview(key, { subject, body }) : null,
    enabled:
      enabled && key !== null && subject.trim() !== '' && body.trim() !== '',
    staleTime: Infinity,
    retry: false,
  })
}
