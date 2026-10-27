import type { QueryClient } from '@tanstack/react-query'

import type { RelationRef } from '@/services/api/core/tenantService'

/**
 * Both kundkort change when a relation does: the subject gains or loses the
 * guardian, the related contact gains or loses the "för" side, and either
 * card's title is derived from those roles.
 */
export const invalidateRelationQueries = (
  queryClient: QueryClient,
  { contactCode, relatedContactCode }: RelationRef
) => {
  for (const code of [contactCode, relatedContactCode]) {
    queryClient.invalidateQueries({ queryKey: ['related-contacts', code] })
    queryClient.invalidateQueries({ queryKey: ['tenant', code] })
  }
}
