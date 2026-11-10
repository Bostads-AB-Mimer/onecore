import { useQuery } from '@tanstack/react-query'

import { tenantService } from '@/services/api/core'
import type { RelatedContact } from '@/services/types'

export function useRelatedContacts(contactCode: string | undefined) {
  return useQuery<RelatedContact[]>({
    queryKey: ['related-contacts', contactCode],
    queryFn: () => tenantService.getRelatedContacts(contactCode!),
    enabled: !!contactCode,
  })
}
