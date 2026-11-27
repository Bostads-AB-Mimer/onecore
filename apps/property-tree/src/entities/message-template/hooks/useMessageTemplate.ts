import { skipToken, useQuery } from '@tanstack/react-query'

import { messageTemplateService } from '@/services/api/core/messageTemplateService'

import { MESSAGE_TEMPLATES_QUERY_KEY } from './useMessageTemplates'

/** One SMS template; pass null to hold the request. */
export function useMessageTemplate(id: string | null) {
  return useQuery({
    // 'detail' keeps it apart from the lists, keyed by status filter.
    queryKey: [MESSAGE_TEMPLATES_QUERY_KEY, 'detail', id],
    queryFn: id ? () => messageTemplateService.get(id) : skipToken,
    staleTime: 0, // the latest saved version: a cached one would resubmit at an old revision
  })
}
