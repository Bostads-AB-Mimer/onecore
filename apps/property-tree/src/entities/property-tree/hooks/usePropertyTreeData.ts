import { useCallback, useMemo } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  queryOptions,
  skipToken,
  useQueries,
  useQuery,
} from '@tanstack/react-query'

import { costCenterService } from '@/services/api/core/costCenterService'
import type {
  PropertyTree,
  PropertyTreeDataNode,
  PropertyTreeGroup,
} from '@/services/api/core/propertyTreeService'
import { propertyTreeService } from '@/services/api/core/propertyTreeService'

import type { WalkNode } from '../model/treeRows'
import { walkTreeFor } from '../model/treeRows'

export type { PropertyTree, PropertyTreeDataNode, PropertyTreeGroup }

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
 * key can't drift between them.
 *
 * Without a root there is nothing to fetch, which skipToken says in the type
 * rather than through an `enabled` flag the fetcher can't see. */
export const propertyTreeQuery = (
  grouping: TreeGrouping,
  rootId: string | undefined
) =>
  queryOptions({
    queryKey: ['propertyTree', grouping, rootId],
    queryFn: rootId
      ? () => propertyTreeService.getTree(grouping, rootId)
      : skipToken,
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })

/** One root's tree and whether it is still arriving. */
export interface RootTreeState {
  tree: PropertyTree | undefined
  isLoading: boolean
}

const NOT_LOADED: RootTreeState = { tree: undefined, isLoading: false }

/**
 * Every root's tree at once, keyed by root id (same cache entries as the
 * per-root hook). Keyed rather than positional: callers used to zip the result
 * array against their own root list, and one of them zipped it against a
 * different list than the one it was fetched with.
 *
 * Roots that aren't being loaded answer `NOT_LOADED` rather than going missing,
 * so callers can ask about any root without checking membership first.
 */
export const usePropertyTrees = (
  grouping: TreeGrouping,
  roots: PropertyTreeRoot[],
  enabled: boolean
) => {
  const queried = useMemo(() => (enabled ? roots : []), [enabled, roots])

  /**
   * Combined here rather than in a useMemo over the results array, so the
   * memoisation is react-query's rather than a bet on that array staying
   * referentially stable — callers memoise whole tree walks on this value.
   *
   * A closure rather than a module-level combine: results carry no query key,
   * and a root still in flight has no `data.id` to key it by, so the roots
   * have to come from outside. Stable as long as `queried` is.
   */
  const combine = useCallback(
    (results: UseQueryResult<PropertyTree | undefined>[]) => {
      const states = new Map<string, RootTreeState>()
      const walks: WalkNode[] = []
      queried.forEach((root, i) => {
        const tree = results[i]?.data
        states.set(root.id, { tree, isLoading: !!results[i]?.isLoading })
        // walkTreeFor caches per tree reference, so walk identities are
        // stable across combine re-runs.
        if (tree) walks.push(walkTreeFor(root, tree))
      })
      return {
        stateOf: (rootId: string) => states.get(rootId) ?? NOT_LOADED,
        isLoading: results.some((r) => r.isLoading),
        /** The loaded roots' walks, in root order — facet counting reads these. */
        walks,
      }
    },
    [queried]
  )

  return useQueries({
    queries: queried.map((root) => propertyTreeQuery(grouping, root.id)),
    combine,
  })
}
