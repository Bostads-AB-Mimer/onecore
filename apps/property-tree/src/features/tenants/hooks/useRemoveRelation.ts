import { useMutation, useQueryClient } from '@tanstack/react-query'

import { tenantService } from '@/services/api/core'
import type {
  RelationError,
  RelationRef,
} from '@/services/api/core/tenantService'

/**
 * Removes a relation and refreshes both kundkort. Removal is a soft delete on
 * the server: the relation stops showing on either card but its history is
 * kept in the contacts service.
 */
export const useRemoveRelation = () => {
  const queryClient = useQueryClient()

  return useMutation<void, RelationError, RelationRef>({
    mutationFn: (ref) => tenantService.removeRelation(ref),
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
