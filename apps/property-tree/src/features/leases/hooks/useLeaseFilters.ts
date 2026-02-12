import { useCallback, useMemo, useRef } from 'react'

import {
  type BuildingManager,
  leaseSearchService,
} from '@/services/api/core/leaseSearchService'

import { useUrlFilters } from '@/shared/hooks/useUrlFilters'
import type { SearchFilterOption } from '@/shared/ui/filters/MultiSelectSearchFilterDropdown'

import { useLeaseSearch } from './useLeaseSearch'

const PAGE_SIZE = 50

const FILTER_KEYS = [
  'objectType',
  'status',
  'property',
  'district',
  'buildingManager',
  'startDateFrom',
  'startDateTo',
  'endDateFrom',
  'endDateTo',
] as const

export function useLeaseFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: PAGE_SIZE,
  })

  const selectedObjectTypes = filters.getFilterValues('objectType')
  const selectedStatuses = filters.getFilterValues('status') as (
    | '0'
    | '1'
    | '2'
    | '3'
  )[]
  const selectedProperties = filters.getFilterValues('property')
  const selectedDistricts = filters.getFilterValues('district')
  const selectedBuildingManagers = filters.getFilterValues('buildingManager')

  const startDateFrom = filters.getFilterValue('startDateFrom')
  const startDateTo = filters.getFilterValue('startDateTo')
  const endDateFrom = filters.getFilterValue('endDateFrom')
  const endDateTo = filters.getFilterValue('endDateTo')

  const searchParams = useMemo(
    () => ({
      q: filters.debouncedSearch || undefined,
      objectType:
        selectedObjectTypes.length > 0 ? selectedObjectTypes : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      property: selectedProperties.length > 0 ? selectedProperties : undefined,
      districtNames:
        selectedDistricts.length > 0 ? selectedDistricts : undefined,
      buildingManager:
        selectedBuildingManagers.length > 0
          ? selectedBuildingManagers
          : undefined,
      startDateFrom: startDateFrom || undefined,
      startDateTo: startDateTo || undefined,
      endDateFrom: endDateFrom || undefined,
      endDateTo: endDateTo || undefined,
    }),
    [
      filters.debouncedSearch,
      selectedObjectTypes,
      selectedStatuses,
      selectedProperties,
      selectedDistricts,
      selectedBuildingManagers,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
    ]
  )

  const {
    data: leases,
    meta,
    isLoading,
    isFetching,
    error,
  } = useLeaseSearch(searchParams, filters.page, PAGE_SIZE)

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / PAGE_SIZE)
    : 1

  // Building manager filter: fetch once, filter client-side
  const buildingManagersRef = useRef<BuildingManager[] | null>(null)
  const searchBuildingManagers = useCallback(
    async (query: string): Promise<SearchFilterOption[]> => {
      if (!buildingManagersRef.current) {
        buildingManagersRef.current =
          await leaseSearchService.getBuildingManagers()
      }

      const q = query.toLowerCase()
      return buildingManagersRef.current
        .filter(
          (bm) =>
            bm.name.toLowerCase().includes(q) ||
            bm.district.toLowerCase().includes(q)
        )
        .map((bm) => ({
          label: `${bm.name} (${bm.code})`,
          value: bm.name,
          description: bm.district,
        }))
    },
    []
  )

  return {
    ...filters,
    pageSize: PAGE_SIZE,

    // Resolved filter values
    selectedObjectTypes,
    selectedStatuses,
    selectedProperties,
    selectedDistricts,
    selectedBuildingManagers,
    startDateFrom,
    startDateTo,
    endDateFrom,
    endDateTo,

    // Search function for async filter dropdown
    searchBuildingManagers,

    // Query results
    leases: leases || [],
    meta,
    totalPages,
    isLoading,
    isFetching,
    error,
  }
}
