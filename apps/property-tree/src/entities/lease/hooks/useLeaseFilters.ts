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
  'includeEnded',
  'sortBy',
  'sortOrder',
] as const

// Default statuses exclude "Upphört" (3) for performance
const DEFAULT_STATUSES: ('0' | '1' | '2')[] = ['0', '1', '2']

const VALID_SORT_KEYS = [
  'leaseStartDate',
  'lastDebitDate',
  'leaseId',
  'address',
  'objectType',
  'rentalObjectCode',
] as const
type ValidSortKey = (typeof VALID_SORT_KEYS)[number]
const isValidSortKey = (v: string | null): v is ValidSortKey =>
  VALID_SORT_KEYS.includes(v as ValidSortKey)

export function useLeaseFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: PAGE_SIZE,
  })

  const { searchParams: urlSearchParams } = filters

  const selectedObjectTypes = useMemo(
    () => urlSearchParams.getAll('objectType'),
    [urlSearchParams]
  )
  const selectedStatuses = useMemo(
    () => urlSearchParams.getAll('status') as ('0' | '1' | '2' | '3')[],
    [urlSearchParams]
  )
  const includeEnded = urlSearchParams.get('includeEnded') === 'true'
  const selectedProperties = useMemo(
    () => urlSearchParams.getAll('property'),
    [urlSearchParams]
  )
  const selectedDistricts = useMemo(
    () => urlSearchParams.getAll('district'),
    [urlSearchParams]
  )
  const selectedBuildingManagers = useMemo(
    () => urlSearchParams.getAll('buildingManager'),
    [urlSearchParams]
  )

  const rawSortBy = urlSearchParams.get('sortBy')
  const sortBy: ValidSortKey | undefined =
    rawSortBy && isValidSortKey(rawSortBy) ? rawSortBy : undefined
  const sortOrder = (urlSearchParams.get('sortOrder') || undefined) as
    | 'asc'
    | 'desc'
    | undefined

  const startDateFrom = urlSearchParams.get('startDateFrom') || ''
  const startDateTo = urlSearchParams.get('startDateTo') || ''
  const endDateFrom = urlSearchParams.get('endDateFrom') || ''
  const endDateTo = urlSearchParams.get('endDateTo') || ''

  const searchParams = useMemo(
    () => ({
      q: filters.debouncedSearch || undefined,
      objectType:
        selectedObjectTypes.length > 0 ? selectedObjectTypes : undefined,
      // includeEnded is not forwarded to the API — it controls whether DEFAULT_STATUSES is applied:
      // - false: DEFAULT_STATUSES (['0','1','2']) is used, excluding Upphört (3)
      // - true: status is omitted entirely so the backend returns all statuses including Upphört
      status:
        selectedStatuses.length > 0
          ? selectedStatuses
          : includeEnded
            ? undefined
            : DEFAULT_STATUSES,
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
      sortBy,
      sortOrder,
    }),
    [
      filters.debouncedSearch,
      selectedObjectTypes,
      selectedStatuses,
      includeEnded,
      selectedProperties,
      selectedDistricts,
      selectedBuildingManagers,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
      sortBy,
      sortOrder,
    ]
  )

  const {
    data: leases,
    meta,
    isLoading,
    isFetching,
    error,
    exportToExcel,
  } = useLeaseSearch(searchParams, filters.page, PAGE_SIZE)

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / PAGE_SIZE)
    : 1

  const handleSort = useCallback(
    (key: string, order: 'asc' | 'desc' | undefined) => {
      filters.updateUrlParams({
        sortBy: order ? key : undefined,
        sortOrder: order ?? undefined,
        page: undefined,
      })
    },
    [filters]
  )

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
    includeEnded,
    selectedProperties,
    selectedDistricts,
    selectedBuildingManagers,
    startDateFrom,
    startDateTo,
    endDateFrom,
    endDateTo,

    // Sorting
    sortBy,
    sortOrder,
    handleSort,

    // Search function for async filter dropdown
    searchBuildingManagers,

    // Query results
    leases: leases || [],
    meta,
    totalPages,
    isLoading,
    isFetching,
    error,
    exportToExcel,

    // Search params (for bulk messaging fetchAllContacts)
    searchParams,
  }
}
