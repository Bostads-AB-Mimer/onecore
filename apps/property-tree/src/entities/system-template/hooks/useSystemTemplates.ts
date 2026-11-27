import { useQuery } from '@tanstack/react-query'

import { systemTemplateService } from '@/services/api/core/systemTemplateService'

export const SYSTEM_TEMPLATES_QUERY_KEY = 'systemTemplates'

/** All system email templates, plus whether the caller may edit them. */
export function useSystemTemplates() {
  return useQuery({
    queryKey: [SYSTEM_TEMPLATES_QUERY_KEY],
    queryFn: () => systemTemplateService.list(),
    staleTime: 5 * 60 * 1000,
  })
}
