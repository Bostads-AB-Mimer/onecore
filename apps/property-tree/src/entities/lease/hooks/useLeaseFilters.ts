import { useCallback, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { propertyManagersQueryOptions } from '@/entities/user'

import { authService } from '@/services/api/core/authService'
import {
  leaseSearchService,
  type LeaseStatusFilter,
  type ParkingSpaceType,
} from '@/services/api/core/leaseSearchService'

import { useUrlFilters } from '@/shared/hooks/useUrlFilters'
import type { SearchFilterOption } from '@/shared/ui/filters/types'

import { isLeaseTypeFilter } from '../lib/leaseType'
import { DEFAULT_PAGE_SIZE, parsePageSize } from '../lib/pageSize'
import { useLeaseSearch } from './useLeaseSearch'

type PropertyManager = Awaited<
  ReturnType<typeof authService.getUsersByRole>
>[number]

const toBuildingManagerOption = (
  user: PropertyManager
): SearchFilterOption => ({
  label:
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username,
  value: user.id,
  description: user.attributes?.employeeId?.[0],
})

const FILTER_KEYS = [
  'objectType',
  'status',
  'leaseType',
  'tenantName',
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
  'tenantName',
] as const
type ValidSortKey = (typeof VALID_SORT_KEYS)[number]
const isValidSortKey = (v: string | null): v is ValidSortKey =>
  VALID_SORT_KEYS.includes(v as ValidSortKey)

const LEASE_STATUS_VALUES: LeaseStatusFilter[] = [
  'current',
  'upcoming',
  'abouttoend',
  'ended',
  'preliminaryterminated',
  'pendingsignature',
  'notsent',
]
const isLeaseStatusFilter = (v: string): v is LeaseStatusFilter =>
  (LEASE_STATUS_VALUES as string[]).includes(v)

export function useLeaseFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const { searchParams: urlSearchParams, updateUrlParams } = filters

  // Not in FILTER_KEYS: "Rensa filter" keeps the chosen page size.
  const pageSize = parsePageSize(urlSearchParams.get('pageSize'))
  const setPageSize = useCallback(
    (size: number) => {
      const next = parsePageSize(String(size))
      updateUrlParams({
        pageSize: next === DEFAULT_PAGE_SIZE ? undefined : next,
        page: undefined,
      })
    },
    [updateUrlParams]
  )

  // objectType and parkingSpaceType are mutually exclusive ("Bilplats" vs a
  // specific subtype) — write both in one step so clearing one and setting
  // the other doesn't lose either change. See ObjectTypeFilter's
  // onObjectAndParkingSpaceTypeChange prop.
  const setObjectAndParkingSpaceType = useCallback(
    (objectTypes: string[], parkingSpaceTypes: string[]) => {
      filters.setMultipleFilterValues({
        objectType: objectTypes,
        parkingSpaceType: parkingSpaceTypes,
      })
    },
    [filters]
  )

  const selectedObjectTypes = useMemo(
    () => urlSearchParams.getAll('objectType'),
    [urlSearchParams]
  )
  const selectedStatuses = useMemo(
    () => urlSearchParams.getAll('status').filter(isLeaseStatusFilter),
    [urlSearchParams]
  )
  // A saved link may hold a contract type the filter no longer offers
  // (e.g. Campuskontrakt); dropped rather than sent as a hidden filter.
  const selectedLeaseTypes = useMemo(
    () => urlSearchParams.getAll('leaseType').filter(isLeaseTypeFilter),
    [urlSearchParams]
  )
  const selectedTenantName = urlSearchParams.get('tenantName') || ''
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
      q:
        filters.debouncedSearch && filters.debouncedSearch.length >= 3
          ? filters.debouncedSearch
          : undefined,
      name: selectedTenantName || undefined,
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
      selectedTenantName,
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
    failureCount,
    failureReason,
    exportToExcel,
  } = useLeaseSearch(searchParams, filters.page, pageSize)

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / pageSize)
    : 1

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

  // Building manager filter: one cached list from Keycloak (property-manager role), filtered client-side.
  // The query cache shares one request between concurrent callers and does not keep a failure.
  const queryClient = useQueryClient()
  const loadPropertyManagers = useCallback(
    () => queryClient.ensureQueryData(propertyManagersQueryOptions),
    [queryClient]
  )

  const searchBuildingManagers = useCallback(
    async (query: string): Promise<SearchFilterOption[]> => {
      const propertyManagers = await loadPropertyManagers()

      const q = query.toLowerCase()
      return propertyManagers
        .filter((u) => {
          const fullName =
            `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase()
          const employeeId = (u.attributes?.employeeId?.[0] ?? '').toLowerCase()
          return fullName.includes(q) || employeeId.includes(q)
        })
        .map(toBuildingManagerOption)
        .sort((a, b) => a.label.localeCompare(b.label, 'sv'))
    },
    [loadPropertyManagers]
  )

  // Names chosen building manager ids (e.g. from a saved link); ids not found are left out
  const resolveBuildingManagerLabels = useCallback(
    async (values: string[]): Promise<SearchFilterOption[]> => {
      const propertyManagers = await loadPropertyManagers()
      return propertyManagers
        .filter((u) => values.includes(u.id))
        .map(toBuildingManagerOption)
    },
    [loadPropertyManagers]
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
    setObjectAndParkingSpaceType,
    pageSize,
    setPageSize,

    // Resolved filter values
    selectedObjectTypes,
    selectedStatuses,
    selectedLeaseTypes,
    selectedTenantName,
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
    resolveBuildingManagerLabels,

    // Parking space type loader for hierarchical objekttyp filter
    loadParkingSpaceTypes,

    // Query results
    leases: leases || [],
    meta,
    totalPages,
    isLoading,
    isFetching,
    error,
    failureCount,
    failureReason,
    exportToExcel,

    // Search params (for bulk messaging fetchAllContacts)
    searchParams,
  }
}
