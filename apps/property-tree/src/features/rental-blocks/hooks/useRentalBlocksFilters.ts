import { useCallback, useMemo, useState } from 'react'

import { residenceService } from '@/services/api/core'
import type { RentalBlocksSearchParams } from '@/services/types'

import { useUrlFilters } from '@/shared/hooks/useUrlFilters'

import { useRentalBlocks } from './useRentalBlocks'

const PAGE_SIZE = 50

const FILTER_KEYS = [
  'active',
  'kategori',
  'fastighet',
  'distrikt',
  'orsak',
  'fromDate',
  'toDate',
] as const

export function useRentalBlocksFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: PAGE_SIZE,
  })

  const activeFilter = useMemo(() => {
    const val = filters.getFilterValue('active')
    if (val === 'true') return true
    if (val === 'false') return false
    if (val === 'all') return undefined
    // Default: active (no URL param set)
    return val ? undefined : true
  }, [filters])

  const setActiveFilter = useCallback(
    (val: 'active' | 'expired' | 'all') => {
      filters.setFilterValue(
        'active',
        val === 'active' ? null : val === 'expired' ? 'false' : 'all'
      )
    },
    [filters]
  )

  const params: RentalBlocksSearchParams = useMemo(
    () => ({
      q: filters.debouncedSearch || undefined,
      kategori: filters.getFilterValue('kategori') || undefined,
      distrikt: filters.getFilterValue('distrikt') || undefined,
      blockReason: filters.getFilterValue('orsak') || undefined,
      fastighet: filters.getFilterValue('fastighet') || undefined,
      fromDateGte: filters.getFilterValue('fromDate') || undefined,
      toDateLte: filters.getFilterValue('toDate') || undefined,
      active: activeFilter,
    }),
    [filters, activeFilter]
  )

  const {
    data: rentalBlocks,
    meta,
    isLoading,
    isFetching,
    error,
  } = useRentalBlocks(params, filters.page, PAGE_SIZE)

  const totalPages = meta?.totalRecords
    ? Math.ceil(meta.totalRecords / PAGE_SIZE)
    : 1

  // Excel export
  const [isExporting, setIsExporting] = useState(false)
  const handleExport = useCallback(async () => {
    if (!meta?.totalRecords || meta.totalRecords === 0) return

    setIsExporting(true)
    try {
      const blob = await residenceService.exportRentalBlocksToExcel(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sparrlista-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [params, meta?.totalRecords])

  return {
    ...filters,
    pageSize: PAGE_SIZE,
    activeFilter,
    setActiveFilter,
    params,

    // Query results
    rentalBlocks: rentalBlocks || [],
    meta,
    totalPages,
    isLoading,
    isFetching,
    error,

    // Export
    isExporting,
    handleExport,
  }
}
