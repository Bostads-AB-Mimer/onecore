import { useMutation, useQueryClient } from '@tanstack/react-query'

import { tenantService } from '@/services/api/core'
import type {
  RelationError,
  RelationRef,
} from '@/services/api/core/tenantService'
import type { RelatedContact } from '@/services/types'

import { invalidateRelationQueries } from '../lib/relationQueries'

export const useAddRelation = () => {
  const queryClient = useQueryClient()

  return useMutation<RelatedContact[], RelationError, RelationRef>({
    mutationFn: (ref) => tenantService.addRelation(ref),
    // onSettled, not onSuccess: a failed propagation that could not be rolled
    // back leaves the relation saved, so refetching only on success would
    // leave the list showing the opposite of what the server holds.
    onSettled: (_data, _error, ref) =>
      invalidateRelationQueries(queryClient, ref),
  })
}
