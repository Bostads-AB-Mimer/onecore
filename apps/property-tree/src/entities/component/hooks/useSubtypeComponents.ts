import { useQuery } from '@tanstack/react-query'

import {
  componentLibraryService,
  type ComponentPage,
  type ComponentPageFilter,
} from '@/services/api/core/componentLibraryService'

import { QUERY_KEY_ROOTS } from '../lib/componentLibraryQueryKeys'
import { samePageSubtype } from '../lib/samePageSubtype'

// Keyed under the instance root so useComponentEntityMutation's invalidation reaches it.
export const useSubtypeComponents = (filter: ComponentPageFilter | undefined) =>
  useQuery<ComponentPage, Error>({
    queryKey: [QUERY_KEY_ROOTS.instance, 'page', filter],
    queryFn: () =>
      componentLibraryService.getComponentPage(filter as ComponentPageFilter),
    enabled: filter !== undefined,
    placeholderData: (previousData, previousQuery) =>
      samePageSubtype(previousQuery?.queryKey, filter)
        ? previousData
        : undefined,
  })
