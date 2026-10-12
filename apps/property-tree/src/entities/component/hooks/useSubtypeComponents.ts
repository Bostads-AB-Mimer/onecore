import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  type ComponentPage,
  type ComponentPageFilter,
  componentLibraryService,
} from '@/services/api/core/componentLibraryService'

import { QUERY_KEY_ROOTS } from '../lib/componentLibraryQueryKeys'

// Keyed under the instance root so useComponentEntityMutation's invalidation reaches it.
export const useSubtypeComponents = (filter: ComponentPageFilter | undefined) =>
  useQuery<ComponentPage, Error>({
    queryKey: [QUERY_KEY_ROOTS.instance, 'page', filter],
    queryFn: () =>
      componentLibraryService.getComponentPage(filter as ComponentPageFilter),
    enabled: filter !== undefined,
    placeholderData: keepPreviousData,
  })
