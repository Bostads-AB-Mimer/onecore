import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'

import { costCenterService } from '@/services/api/core/costCenterService'
import type {
  PropertyTree,
  PropertyTreeGroup,
  PropertyTreeProperty,
} from '@/services/api/core/propertyTreeService'
import { propertyTreeService } from '@/services/api/core/propertyTreeService'

export type { PropertyTree, PropertyTreeGroup, PropertyTreeProperty }
export type PropertyTreeBuilding = PropertyTreeProperty['buildings'][number]
export type PropertyTreeStaircase = PropertyTreeBuilding['staircases'][number]
export type PropertyTreeParkingArea =
  PropertyTreeProperty['parkingAreas'][number]

/** The groupings the picker offers. The endpoint also serves 'company', but
 * that view is for sidebar navigation rather than choosing an audience. */
export type TreeGrouping = 'costCenter' | 'marketArea'

/** One top-level root of a grouping — a district, or a marknadsområde. */
export interface PropertyTreeRoot {
  grouping: TreeGrouping
  /** What the endpoint takes as rootId: a uuid for cost centers, a code for
   * market areas. */
  id: string
  code: string
  name: string
}

// Trees change perhaps yearly; the server caches them too. Trusting the cache
// keeps re-expanding, searching and switching views from refiring requests.
// Shared with the per-root object fetch so the two can't drift apart.
export const TREE_STALE_TIME = 10 * 60 * 1000
export const TREE_GC_TIME = 15 * 60 * 1000

/** All roots of one grouping, normalised to a common shape. */
export const usePropertyTreeRoots = (grouping: TreeGrouping) => {
  const costCenters = useQuery({
    queryKey: ['costCenters'],
    queryFn: () => costCenterService.getAll(),
    enabled: grouping === 'costCenter',
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })
  const marketAreas = useQuery({
    queryKey: ['marketAreas'],
    queryFn: () => propertyTreeService.getMarketAreas(),
    enabled: grouping === 'marketArea',
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })

  const source = grouping === 'costCenter' ? costCenters : marketAreas
  const roots = useMemo<PropertyTreeRoot[]>(() => {
    if (grouping === 'costCenter') {
      return (costCenters.data ?? []).map((c) => ({
        grouping,
        id: c.id,
        code: c.code,
        name: c.name,
      }))
    }
    return (marketAreas.data ?? []).map((a) => ({
      grouping,
      id: a.code,
      code: a.code,
      name: a.name ?? a.code,
    }))
  }, [grouping, costCenters.data, marketAreas.data])

  return { roots, isLoading: source.isLoading }
}

/** One definition of a tree query — key, fetcher and both TTLs. Every hook
 * that wants a tree builds from this, so they share the cache entry and the
 * key can't drift between them. */
export const propertyTreeQuery = (grouping: TreeGrouping, rootId: string) => ({
  queryKey: ['propertyTree', grouping, rootId],
  queryFn: () => propertyTreeService.getTree(grouping, rootId),
  staleTime: TREE_STALE_TIME,
  gcTime: TREE_GC_TIME,
})

export const usePropertyTree = (
  grouping: TreeGrouping,
  rootId: string | undefined
) =>
  useQuery({
    ...propertyTreeQuery(grouping, rootId as string),
    enabled: !!rootId,
  })

/** Every root's tree at once (same cache entries as the per-root hook).
 * Used by search, which spans all roots of the current grouping. */
export const usePropertyTrees = (
  grouping: TreeGrouping,
  roots: PropertyTreeRoot[],
  enabled: boolean
) =>
  useQueries({
    queries: (enabled ? roots : []).map((root) =>
      propertyTreeQuery(grouping, root.id)
    ),
  })
