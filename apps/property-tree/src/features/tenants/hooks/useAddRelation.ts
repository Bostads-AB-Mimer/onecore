import { useMutation, useQueryClient } from '@tanstack/react-query'

import { tenantService } from '@/services/api/core'
import type {
  RelationError,
  RelationRef,
} from '@/services/api/core/tenantService'
import type { RelatedContact } from '@/services/types'

/**
 * Adds a relation and refreshes both kundkort: the relation shows as
 * trustee/administrator on the subject and as trusteeFor/administratorFor on
 * the related contact, and either card's title may change.
 */
export const useAddRelation = () => {
  const queryClient = useQueryClient()

  return useMutation<RelatedContact[], RelationError, RelationRef>({
    mutationFn: (ref) => tenantService.addRelation(ref),
    onSuccess: (_data, ref) => {
      queryClient.invalidateQueries({
        queryKey: ['related-contacts', ref.contactCode],
      })
      queryClient.invalidateQueries({
        queryKey: ['related-contacts', ref.relatedContactCode],
      })
      queryClient.invalidateQueries({ queryKey: ['tenant', ref.contactCode] })
      queryClient.invalidateQueries({
        queryKey: ['tenant', ref.relatedContactCode],
      })
    },
  })
}
