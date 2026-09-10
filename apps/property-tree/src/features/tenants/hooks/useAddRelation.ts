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
    onSuccess: (_data, ref) => invalidateRelationQueries(queryClient, ref),
  })
}
