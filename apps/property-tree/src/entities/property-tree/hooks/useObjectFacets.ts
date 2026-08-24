import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import { propertyTreeService } from '@/services/api/core/propertyTreeService'

import type { FacetIndex, ObjectFilter, RentalObject } from '../model/facets'
import {
  addAncestorCounts,
  buildFacetIndex,
  filterSignature,
} from '../model/facets'
import { ancestorPropertyKeys, rootKeyOf } from '../model/treeRows'
import type {
  PropertyTree,
  PropertyTreeRoot,
  TreeGrouping,
} from './usePropertyTreeData'
import { propertyTreeQuery } from './usePropertyTreeData'
import { rootRentalObjectsQuery } from './useRootRentalObjects'

// Combines live outside the hook: react-query memoises them by identity, and a
// fresh closure per render would recompute the whole fold every time.
const combineObjects = (
  results: {
    data?: Awaited<ReturnType<typeof propertyTreeService.getRootRentalObjects>>
  }[]
) => ({
  objects: results.flatMap((r) => r.data ?? []),
  // Settled rather than objects.length: a root that legitimately holds zero
  // objects still counts. Pairs by index with the loadedRoots the queries
  // map over.
  settled: results.map((r) => r.data !== undefined),
})

const combineAncestry = (results: { data?: PropertyTree | undefined }[]) =>
  results.flatMap((r) => {
    const tree = r.data
    // 'company' never reaches the picker; the grouping switcher offers the
    // two the tree walker knows about.
    if (!tree || tree.grouping === 'company') return []
    const root: PropertyTreeRoot = {
      grouping: tree.grouping,
      id: tree.id,
      code: tree.code,
      name: tree.name ?? tree.code,
    }
    return ancestorPropertyKeys(root, tree)
  })

/**
 * Filtered counts per tree node, computed from the loaded roots' rental
 * objects. Recomputes only when the objects or the filter change, so toggling
 * a filter costs one pass over the loaded rows and no request at all.
 *
 * `loadedRoots` must hold only the roots whose data should be fetched — the
 * expanded ones, or all of them in search mode. Everything else keeps falling
 * back to the tree's own per-type counts.
 */
export function useObjectFacets(
  grouping: TreeGrouping,
  loadedRoots: PropertyTreeRoot[],
  enabled: boolean,
  filter: ObjectFilter
): { facets: FacetIndex; objects: RentalObject[] } {
  const { objects, settled } = useQueries({
    queries: (enabled ? loadedRoots : []).map((root) =>
      rootRentalObjectsQuery(grouping, root.id)
    ),
    combine: combineObjects,
  })

  // Objects name their property but not the levels above it, so district and
  // KVV-area counts are summed from the tree's own structure.
  const ancestry = useQueries({
    queries: (enabled ? loadedRoots : []).map((root) =>
      propertyTreeQuery(grouping, root.id)
    ),
    combine: combineAncestry,
  })

  // Roots whose objects have resolved: below them a missing facet key is a
  // true zero, so empty branches show 0 and grey out under a filter.
  const settledRootKeys = useMemo(() => {
    const keys = new Set<string>()
    const roots = enabled ? loadedRoots : []
    roots.forEach((root, i) => {
      if (settled[i]) keys.add(rootKeyOf(root))
    })
    return keys
  }, [enabled, loadedRoots, settled])

  const signature = filterSignature(filter)
  const facets = useMemo(
    () =>
      addAncestorCounts(
        buildFacetIndex(objects, filter, settledRootKeys),
        ancestry
      ),
    // filter is covered by its signature; the arrays are combine-memoised.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [objects, settledRootKeys, ancestry, signature]
  )

  // The objects ride along: roll-up over leaf selections needs them as the
  // children of their trapphus or parkeringsområde.
  return useMemo(() => ({ facets, objects }), [facets, objects])
}
