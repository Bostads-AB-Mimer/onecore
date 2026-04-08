import { useCallback, useMemo, useRef } from 'react'

import {
  type BuildingManager,
  leaseSearchService,
  type ParkingSpaceType,
} from '@/services/api/core/leaseSearchService'

import { useUrlFilters } from '@/shared/hooks/useUrlFilters'
import type { SearchFilterOption } from '@/shared/ui/filters/MultiSelectSearchFilterDropdown'

import { useLeaseSearch } from './useLeaseSearch'

const PAGE_SIZE = 50

const FILTER_KEYS = [
  'objectType',
  'status',
  'leaseType',
  'property',
  'district',
  'buildingManager',
  'parkingSpaceType',
  'startDateFrom',
  'startDateTo',
  'endDateFrom',
  'endDateTo',
  'sortBy',
  'sortOrder',
] as const

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
  const selectedLeaseTypes = useMemo(
    () => urlSearchParams.getAll('leaseType'),
    [urlSearchParams]
  )
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
  const selectedParkingSpaceTypes = useMemo(
    () => urlSearchParams.getAll('parkingSpaceType'),
    [urlSearchParams]
  )

  const rawSortBy = urlSearchParams.get('sortBy')
  const sortBy: ValidSortKey | undefined =
    rawSortBy && isValidSortKey(rawSortBy) ? rawSortBy : undefined
  const rawSortOrder = urlSearchParams.get('sortOrder')
  const sortOrder: 'asc' | 'desc' | undefined =
    rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : undefined

  const startDateFrom = urlSearchParams.get('startDateFrom') || ''
  const startDateTo = urlSearchParams.get('startDateTo') || ''
  const endDateFrom = urlSearchParams.get('endDateFrom') || ''
  const endDateTo = urlSearchParams.get('endDateTo') || ''

  const searchParams = useMemo(
    () => ({
      q: filters.debouncedSearch || undefined,
      objectType:
        selectedObjectTypes.length > 0 ? selectedObjectTypes : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      leaseType: selectedLeaseTypes.length > 0 ? selectedLeaseTypes : undefined,
      property: selectedProperties.length > 0 ? selectedProperties : undefined,
      districtNames:
        selectedDistricts.length > 0 ? selectedDistricts : undefined,
      buildingManager:
        selectedBuildingManagers.length > 0
          ? selectedBuildingManagers
          : undefined,
      parkingSpaceType:
        selectedParkingSpaceTypes.length > 0
          ? selectedParkingSpaceTypes
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
      selectedLeaseTypes,
      selectedProperties,
      selectedDistricts,
      selectedBuildingManagers,
      selectedParkingSpaceTypes,
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

  const { updateUrlParams } = filters
  const handleSort = useCallback(
    (key: string, order: 'asc' | 'desc' | undefined) => {
      updateUrlParams({
        sortBy: order ? key : undefined,
        sortOrder: order ?? undefined,
        page: undefined,
      })
    },
    [updateUrlParams]
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

  // Parking space types: fetch once on first request, cache result
  const parkingSpaceTypesRef = useRef<ParkingSpaceType[] | null>(null)
  const loadParkingSpaceTypes = useCallback(async (): Promise<
    ParkingSpaceType[]
  > => {
    if (!parkingSpaceTypesRef.current) {
      parkingSpaceTypesRef.current =
        await leaseSearchService.getParkingSpaceTypes()
    }
    return parkingSpaceTypesRef.current
  }, [])

  return {
    ...filters,
    pageSize: PAGE_SIZE,

    // Resolved filter values
    selectedObjectTypes,
    selectedStatuses,
    selectedLeaseTypes,
    selectedProperties,
    selectedDistricts,
    selectedBuildingManagers,
    selectedParkingSpaceTypes,
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

    // Parking space type loader for hierarchical objekttyp filter
    loadParkingSpaceTypes,

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
