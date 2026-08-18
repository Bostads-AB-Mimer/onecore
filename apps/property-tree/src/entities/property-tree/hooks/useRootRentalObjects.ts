import { queryOptions, skipToken } from '@tanstack/react-query'

import { propertyTreeService } from '@/services/api/core/propertyTreeService'
import type { RentalObjectSummary as RentalObject } from '@/services/api/core/rentalObjectService'

import type { TreeGrouping } from './usePropertyTreeData'
import { TREE_GC_TIME, TREE_STALE_TIME } from './usePropertyTreeData'

export type { RentalObject }

/** One definition of a root's object query — all objects under one grouping
 * root, cached like the tree so counting/filtering happen locally. */
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
