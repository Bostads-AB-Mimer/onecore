import { queryOptions, skipToken, useQuery } from '@tanstack/react-query'

import { propertyTreeService } from '@/services/api/core/propertyTreeService'
import type { RentalObjectSummary as RentalObject } from '@/services/api/core/rentalObjectService'

import type { TreeGrouping } from './usePropertyTreeData'
import { TREE_GC_TIME, TREE_STALE_TIME } from './usePropertyTreeData'

export type { RentalObject }

/** One definition of a root's object query, shared with the facet counts so
 * both read the same cache entry. */
export const rootRentalObjectsQuery = (
  grouping: TreeGrouping,
  rootId: string | undefined
) =>
  queryOptions({
    queryKey: ['rootRentalObjects', grouping, rootId],
    queryFn: rootId
      ? () => propertyTreeService.getRootRentalObjects(grouping, rootId)
      : skipToken,
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })

/**
 * Every rental object under one grouping root, fetched alongside the tree and
 * cached the same way. Counting and filtering then happen locally: a whole
 * district is thousands of objects but tens of KB compressed, and re-counting
 * them in the browser is a millisecond where a server round trip is hundreds.
 */
export const useRootRentalObjects = (
  grouping: TreeGrouping,
  rootId: string | undefined
) => useQuery(rootRentalObjectsQuery(grouping, rootId))
