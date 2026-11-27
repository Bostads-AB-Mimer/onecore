import { skipToken, useQuery } from '@tanstack/react-query'

import {
  systemTemplateService,
  type SystemTemplateKey,
} from '@/services/api/core/systemTemplateService'

import { SYSTEM_TEMPLATES_QUERY_KEY } from './useSystemTemplates'

/** One system email template; pass null to hold the request. */
export function useSystemTemplate(key: SystemTemplateKey | null) {
  return useQuery({
    queryKey: [SYSTEM_TEMPLATES_QUERY_KEY, key],
    queryFn: key ? () => systemTemplateService.get(key) : skipToken,
    staleTime: 0, // the latest saved version: a cached one would resubmit at an old revision
  })
}
