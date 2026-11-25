import { useCallback, useMemo } from 'react'

import type { DispatchSearchQueryParams } from '@/services/api/core/communicationService'

import { useUrlFilters } from '@/shared/hooks/useUrlFilters'

import { useDispatchSearch } from './useDispatchSearch'

const PAGE_SIZE = 25

const FILTER_KEYS = [
  'channel',
  'status',
  'messageType',
  'source',
  'sendAtFrom',
  'sendAtTo',
  'sortBy',
  'sortOrder',
] as const

export function useDispatchFilters() {
  const filters = useUrlFilters({
    filterKeys: FILTER_KEYS,
    pageSize: PAGE_SIZE,
  })

  const { searchParams: urlSearchParams } = filters

  const selectedChannels = useMemo(
    () => urlSearchParams.getAll('channel'),
    [urlSearchParams]
  )
  const selectedStatuses = useMemo(
    () => urlSearchParams.getAll('status'),
    [urlSearchParams]
  )
  const selectedMessageTypes = useMemo(
    () => urlSearchParams.getAll('messageType'),
    [urlSearchParams]
  )

  const source = urlSearchParams.get('source') || ''
  const sendAtFrom = urlSearchParams.get('sendAtFrom') || ''
  const sendAtTo = urlSearchParams.get('sendAtTo') || ''

  // Forwarded as-is (an invalid value 400s rather than being silently dropped,
  // consistent with the channel/status/source filters).
  const sortBy = (urlSearchParams.get('sortBy') ||
    undefined) as DispatchSearchQueryParams['sortBy']
  const sortOrder = (urlSearchParams.get('sortOrder') ||
    undefined) as DispatchSearchQueryParams['sortOrder']

  const searchParams = useMemo<DispatchSearchQueryParams>(
    () => ({
      q: filters.debouncedSearch || undefined,
      channel: selectedChannels.length > 0 ? selectedChannels : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      messageType:
        selectedMessageTypes.length > 0 ? selectedMessageTypes : undefined,
      source: (source as 'manual' | 'automatic') || undefined,
      sendAtFrom: sendAtFrom || undefined,
      sendAtTo: sendAtTo || undefined,
      sortBy,
      sortOrder,
    }),
    [
      filters.debouncedSearch,
      selectedChannels,
      selectedStatuses,
      selectedMessageTypes,
      source,
      sendAtFrom,
      sendAtTo,
      sortBy,
      sortOrder,
    ]
  )

  const { data, meta, isLoading, isFetching, error } = useDispatchSearch(
    searchParams,
    filters.page,
    PAGE_SIZE
  )

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

  return {
    ...filters,
    pageSize: PAGE_SIZE,

    // Resolved filter values
    selectedChannels,
    selectedStatuses,
    selectedMessageTypes,
    source,
    sendAtFrom,
    sendAtTo,

    // Sorting
    sortBy,
    sortOrder,
    handleSort,

    // Query results
    dispatches: data || [],
    meta,
    totalPages,
    isLoading,
    isFetching,
    error,

    // Raw params
    searchParams,
  }
}
