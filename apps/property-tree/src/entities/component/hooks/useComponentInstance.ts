import { skipToken, useQuery, type UseQueryResult } from '@tanstack/react-query'

import { componentLibraryService } from '@/services/api/core/componentLibraryService'
import type { Component } from '@/services/types'

import { componentInstanceQueryKey } from '../lib/componentLibraryQueryKeys'

/** One component with every installation, past ones included. Without an id
 * there is nothing to fetch, which skipToken says in the type. */
export function useComponentInstance(
  componentId: string | undefined
): UseQueryResult<Component> {
  return useQuery({
    queryKey: componentInstanceQueryKey(componentId),
    queryFn: componentId
      ? () => componentLibraryService.getInstanceById(componentId)
      : skipToken,
  })
}
