import { useCallback, useEffect, useMemo, useState } from 'react'

import { useDebounce } from './useDebounce'
import { useUrlPagination } from './useUrlPagination'

interface UseUrlFiltersOptions {
  /** URL parameter keys that are considered filters (not pagination/search) */
  filterKeys: readonly string[]
  /** Page size for pagination (default: 50) */
  pageSize?: number
  /** Debounce delay in ms for search input (default: 300) */
  debounceMs?: number
}

export function useUrlFilters({
  filterKeys,
  pageSize = 50,
  debounceMs = 300,
}: UseUrlFiltersOptions) {
  const { page, setPage, searchParams, setSearchParams, updateUrlParams } =
    useUrlPagination({ defaultLimit: pageSize })

  // --- Search ---
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )
  const debouncedSearch = useDebounce(searchInput, debounceMs)

  // Sync debounced search → URL
  useEffect(() => {
    const currentSearch = searchParams.get('search') || ''
    if (debouncedSearch !== currentSearch) {
      updateUrlParams(
        { search: debouncedSearch || undefined, page: undefined },
        { replace: true }
      )
    }
  }, [debouncedSearch, searchParams, updateUrlParams])

  // Sync URL → input (browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== searchInput) {
      setSearchInput(urlSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // --- Single-value filters ---
  const getFilterValue = useCallback(
    (key: string) => searchParams.get(key) || '',
    [searchParams]
  )

  const setFilterValue = useCallback(
    (key: string, value: string | null) => {
      updateUrlParams({ [key]: value || undefined, page: undefined })
    },
    [updateUrlParams]
  )

  // --- Multi-value filters ---
  const getFilterValues = useCallback(
    (key: string) => searchParams.getAll(key),
    [searchParams]
  )

  const setFilterValues = useCallback(
    (key: string, values: string[]) => {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete(key)
      values.forEach((v) => newParams.append(key, v))
      newParams.delete('page')
      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
  )

  // --- Date range filters ---
  const setDateRange = useCallback(
    (
      startKey: string,
      endKey: string,
      start: string | null,
      end: string | null
    ) => {
      updateUrlParams({
        [startKey]: start || undefined,
        [endKey]: end || undefined,
        page: undefined,
      })
    },
    [updateUrlParams]
  )

  // --- Clear & active detection ---
  const hasActiveFilters = useMemo(
    () =>
      !!debouncedSearch ||
      filterKeys.some(
        (key) => searchParams.has(key) && searchParams.getAll(key).some(Boolean)
      ),
    [debouncedSearch, filterKeys, searchParams]
  )

  const clearFilters = useCallback(() => {
    setSearchInput('')
    const clearParams: Record<string, undefined> = {
      search: undefined,
      page: undefined,
    }
    filterKeys.forEach((key) => {
      clearParams[key] = undefined
    })
    updateUrlParams(clearParams)
  }, [filterKeys, updateUrlParams])

  return {
    // Pagination
    page,
    pageSize,
    setPage,

    // Search
    searchInput,
    setSearchInput,
    debouncedSearch,

    // Single-value filters
    getFilterValue,
    setFilterValue,

    // Multi-value filters
    getFilterValues,
    setFilterValues,

    // Date ranges
    setDateRange,

    // URL params (for reading date params, etc.)
    searchParams,

    // Active state
    hasActiveFilters,
    clearFilters,
  }
}
