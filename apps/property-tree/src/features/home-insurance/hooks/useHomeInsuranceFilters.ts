import { useCallback, useMemo } from 'react'

import { useHomeInsurances } from '@/entities/lease'

import { homeInsuranceService } from '@/services/api/core/homeInsuranceService'

import { useExcelExport } from '@/shared/hooks/useExcelExport'
import { useUrlFilters } from '@/shared/hooks/useUrlFilters'

import {
  type HomeInsuranceView,
  parseHomeInsuranceView,
  toHomeInsuranceQuery,
} from '../lib/homeInsuranceFilters'

const PAGE_SIZE = 100

// view is a mode, not a filter: "Rensa alla filter" keeps it.
const FILTER_KEYS = ['status', 'sortBy', 'sortOrder'] as const

export function useHomeInsuranceFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: PAGE_SIZE,
  })
  const { searchParams: urlParams, debouncedSearch, updateUrlParams } = filters

  const query = useMemo(
    () => toHomeInsuranceQuery(urlParams, debouncedSearch),
    [urlParams, debouncedSearch]
  )
  const view = parseHomeInsuranceView(urlParams.get('view'))
  const selectedStatuses = query.status ?? []

  const list = useHomeInsurances(query, filters.page, PAGE_SIZE)
  const totalRecords = list.data?._meta.totalRecords ?? 0

  const setView = useCallback(
    (next: HomeInsuranceView) =>
      updateUrlParams({
        view: next === 'lf' ? undefined : next,
        page: undefined,
      }),
    [updateUrlParams]
  )

  const handleSort = useCallback(
    (key: string, order: 'asc' | 'desc' | undefined) =>
      updateUrlParams({
        sortBy: order ? key : undefined,
        sortOrder: order,
        page: undefined,
      }),
    [updateUrlParams]
  )

  const exportMutation = useExcelExport(
    () => homeInsuranceService.exportToExcel(query),
    'hemforsakringar'
  )

  return {
    ...filters,
    view,
    setView,
    selectedStatuses,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    handleSort,

    rows: list.data?.content ?? [],
    totalRecords,
    totalPages: Math.max(1, Math.ceil(totalRecords / PAGE_SIZE)),
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    error: list.error,
    failureReason: list.failureReason,

    exportToExcel: exportMutation.mutate,
    isExporting: exportMutation.isPending,
  }
}
