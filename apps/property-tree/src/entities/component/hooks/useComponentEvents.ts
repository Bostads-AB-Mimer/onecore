import { skipToken, useQuery, type UseQueryResult } from '@tanstack/react-query'

import { componentService } from '@/services/api/core'
import type { ComponentEvent } from '@/services/types'

import { componentEventsQueryKey } from '../lib/componentLibraryQueryKeys'

/** A component's recorded events, newest first. Without an id there is nothing
 * to fetch, which skipToken says in the type and which keeps the query disabled. */
export function useComponentEvents(
  componentId: string | undefined
): UseQueryResult<ComponentEvent[]> {
  return useQuery({
    queryKey: componentEventsQueryKey(componentId),
    queryFn: componentId
      ? () => componentService.getEvents(componentId)
      : skipToken,
    // Inspections and Odoo write events that nothing here invalidates
    staleTime: 0,
  })
}
