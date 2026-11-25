import { useQuery } from '@tanstack/react-query'

import {
  messageTemplateService,
  type MessageTemplateStatusFilter,
} from '@/services/api/core/messageTemplateService'

export const MESSAGE_TEMPLATES_QUERY_KEY = 'messageTemplates'

// Pass enabled: false to hold the request until the templates are needed
// (the SMS modal only fetches while open). refetchOnWindowFocus: 'always'
// lets a picker catch templates managed in another tab despite the staleTime.
export function useMessageTemplates(
  status: MessageTemplateStatusFilter = 'active',
  options: { enabled?: boolean; refetchOnWindowFocus?: boolean | 'always' } = {}
) {
  return useQuery({
    queryKey: [MESSAGE_TEMPLATES_QUERY_KEY, status],
    queryFn: () => messageTemplateService.list(status),
    staleTime: 5 * 60 * 1000,
    enabled: options.enabled ?? true,
    ...(options.refetchOnWindowFocus !== undefined && {
      refetchOnWindowFocus: options.refetchOnWindowFocus,
    }),
  })
}
