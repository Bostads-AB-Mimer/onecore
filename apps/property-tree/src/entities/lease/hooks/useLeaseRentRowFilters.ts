import { useMemo } from 'react'

import type {
  LeaseRentRowKindFilter,
  LeaseRentRowStatusFilter,
} from '@/services/api/core/leaseRentRowService'

import { useUrlFilters } from '@/shared/hooks/useUrlFilters'

import {
  type LeaseRentRowsFilterParams,
  useLeaseRentRows,
} from './useLeaseRentRows'

const PAGE_SIZE = 100

const FILTER_KEYS = ['status', 'filter'] as const

const STATUS_VALUES: readonly LeaseRentRowStatusFilter[] = [
  'current',
  'upcoming',
  'about-to-end',
  'ended',
  'pending-signature',
  'preliminary-terminated',
  'not-sent',
]
const isStatus = (v: string): v is LeaseRentRowStatusFilter =>
  STATUS_VALUES.some((s) => s === v)

const KIND_VALUES: readonly LeaseRentRowKindFilter[] = [
  'homeInsurance',
  'sameDate',
]
const isKind = (v: string): v is LeaseRentRowKindFilter =>
  KIND_VALUES.some((k) => k === v)

/** URL-backed filters, search and pagination for the Avtalsrader page. */
export function useLeaseRentRowFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: PAGE_SIZE,
  })
  const { searchParams: urlSearchParams } = filters

  const selectedStatuses = useMemo(
    () => urlSearchParams.getAll('status').filter(isStatus),
    [urlSearchParams]
  )
  const rawKind = urlSearchParams.get('filter') ?? ''
  const selectedKind = isKind(rawKind) ? rawKind : undefined

  const params = useMemo<LeaseRentRowsFilterParams>(
    () => ({
      // Lease and contact numbers are at least 3 characters (P12, 705-...)
      q:
        filters.debouncedSearch && filters.debouncedSearch.length >= 3
          ? filters.debouncedSearch
          : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      filter: selectedKind,
    }),
    [filters.debouncedSearch, selectedStatuses, selectedKind]
  )

  const result = useLeaseRentRows(params, filters.page, PAGE_SIZE)

  const totalPages = result.meta?.totalRecords
    ? Math.ceil(result.meta.totalRecords / PAGE_SIZE)
    : 1

  return {
    ...result,
    params,
    page: filters.page,
    setPage: filters.setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    searchInput: filters.searchInput,
    setSearchInput: filters.setSearchInput,
    selectedStatuses,
    setStatuses: (values: string[]) =>
      filters.setFilterValues('status', values),
    selectedKind,
    setKind: (value: string | null) => filters.setFilterValue('filter', value),
    hasActiveFilters: filters.hasActiveFilters,
    clearFilters: filters.clearFilters,
  }
}
