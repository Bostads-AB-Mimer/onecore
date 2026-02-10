import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import { useDebounce } from '@/hooks/useDebounce'
import type { RentalBlocksSearchParams } from '@/services/types'

const PAGE_SIZE = 50

export function useRentalBlocksFilters() {
  const { page, setPage, searchParams, updateUrlParams } = useUrlPagination({
    defaultLimit: PAGE_SIZE,
  })

  const activeFilter = useMemo(() => {
    const val = searchParams.get('active')
    if (val === 'true') return true
    if (val === 'false') return false
    if (val === 'all') return undefined
    return true
  }, [searchParams])

  const selectedKategori = useMemo(
    () => searchParams.get('kategori') || '',
    [searchParams]
  )
  const selectedFastighet = useMemo(
    () => searchParams.get('fastighet') || '',
    [searchParams]
  )
  const selectedDistrikt = useMemo(
    () => searchParams.get('distrikt') || '',
    [searchParams]
  )
  const selectedOrsak = useMemo(
    () => searchParams.get('orsak') || '',
    [searchParams]
  )
  const startDatum = useMemo(
    () => searchParams.get('fromDate') || '',
    [searchParams]
  )
  const slutDatum = useMemo(
    () => searchParams.get('toDate') || '',
    [searchParams]
  )

  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )
  const debouncedSearch = useDebounce(searchInput, 300)

  useEffect(() => {
    const currentSearch = searchParams.get('search') || ''
    if (debouncedSearch !== currentSearch) {
      updateUrlParams(
        { search: debouncedSearch || undefined, page: undefined },
        { replace: true }
      )
    }
  }, [debouncedSearch, searchParams, updateUrlParams])

  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== searchInput) {
      setSearchInput(urlSearch)
    }
  }, [searchParams])

  const setActiveFilter = useCallback(
    (val: 'active' | 'expired' | 'all') => {
      updateUrlParams({
        active:
          val === 'active' ? undefined : val === 'expired' ? 'false' : 'all',
        page: undefined,
      })
    },
    [updateUrlParams]
  )

  const setSelectedKategori = useCallback(
    (val: string | null) => {
      updateUrlParams({ kategori: val || undefined, page: undefined })
    },
    [updateUrlParams]
  )

  const setSelectedFastighet = useCallback(
    (val: string | null) => {
      updateUrlParams({ fastighet: val || undefined, page: undefined })
    },
    [updateUrlParams]
  )

  const setSelectedDistrikt = useCallback(
    (val: string | null) => {
      updateUrlParams({ distrikt: val || undefined, page: undefined })
    },
    [updateUrlParams]
  )

  const setSelectedOrsak = useCallback(
    (val: string | null) => {
      updateUrlParams({ orsak: val || undefined, page: undefined })
    },
    [updateUrlParams]
  )

  const setDateRange = useCallback(
    (start: string | null, end: string | null) => {
      updateUrlParams({
        fromDate: start || undefined,
        toDate: end || undefined,
        page: undefined,
      })
    },
    [updateUrlParams]
  )

  const clearFilters = useCallback(() => {
    setSearchInput('')
    updateUrlParams({
      search: undefined,
      active: undefined,
      kategori: undefined,
      fastighet: undefined,
      distrikt: undefined,
      orsak: undefined,
      fromDate: undefined,
      toDate: undefined,
      page: undefined,
    })
  }, [updateUrlParams])

  const hasActiveFilters =
    debouncedSearch ||
    activeFilter !== true ||
    selectedKategori ||
    selectedFastighet ||
    selectedDistrikt ||
    selectedOrsak ||
    startDatum ||
    slutDatum

  const params: RentalBlocksSearchParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      kategori: selectedKategori || undefined,
      distrikt: selectedDistrikt || undefined,
      blockReason: selectedOrsak || undefined,
      fastighet: selectedFastighet || undefined,
      fromDateGte: startDatum || undefined,
      toDateLte: slutDatum || undefined,
      active: activeFilter,
    }),
    [
      debouncedSearch,
      selectedKategori,
      selectedDistrikt,
      selectedOrsak,
      selectedFastighet,
      startDatum,
      slutDatum,
      activeFilter,
    ]
  )

  return {
    page,
    pageSize: PAGE_SIZE,
    setPage,
    params,
    searchInput,
    setSearchInput,
    activeFilter,
    selectedKategori,
    setSelectedKategori,
    selectedFastighet,
    setSelectedFastighet,
    selectedDistrikt,
    setSelectedDistrikt,
    selectedOrsak,
    setSelectedOrsak,
    startDatum,
    slutDatum,
    setDateRange,
    setActiveFilter,
    clearFilters,
    hasActiveFilters,
  }
}
