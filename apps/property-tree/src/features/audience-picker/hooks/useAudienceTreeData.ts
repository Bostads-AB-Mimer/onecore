import { useQueries, useQuery } from '@tanstack/react-query'

import { costCenterService } from '@/services/api/core/costCenterService'
import type { components } from '@/services/api/core/generated/api-types'

export type CostCenterSummary = components['schemas']['CostCenterSummary']
export type CostCenterTree = components['schemas']['CostCenterTree']
export type CostCenterTreeKvvArea = CostCenterTree['kvvAreas'][number]
export type CostCenterTreeProperty = CostCenterTreeKvvArea['properties'][number]
export type CostCenterTreeBuilding = CostCenterTreeProperty['buildings'][number]
export type CostCenterTreeParkingArea =
  CostCenterTreeProperty['parkingAreas'][number]

// Trees change only on admin edits — trust the cache so re-enabling a query
// (open/search/expand) doesn't refire a tree request per district. Each tree
// request costs 6 concurrent DB queries; storms exhaust the service's pool.
const TREE_STALE_TIME = 10 * 60 * 1000
const TREE_GC_TIME = 15 * 60 * 1000

// Same query keys as features/property-areas so the cache is shared.
export const useAudienceDistricts = () =>
  useQuery({
    queryKey: ['costCenters'],
    queryFn: () => costCenterService.getAll(),
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })

export const useAudienceDistrictTree = (id: string | undefined) =>
  useQuery({
    queryKey: ['costCenterTree', id],
    queryFn: () => costCenterService.getTreeById(id as string),
    enabled: !!id,
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
  })

/** All district trees at once (same cache entries as the per-district hook).
 * Used by "select all matches", which spans every district. */
export const useAudienceDistrictTrees = (
  districts: CostCenterSummary[] | undefined,
  enabled: boolean
) =>
  useQueries({
    queries: (enabled ? (districts ?? []) : []).map((district) => ({
      queryKey: ['costCenterTree', district.id],
      queryFn: () => costCenterService.getTreeById(district.id),
      staleTime: TREE_STALE_TIME,
      gcTime: TREE_GC_TIME,
    })),
  })
