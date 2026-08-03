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

const VALID_SORT_KEYS = ['sendAt', 'recipientCount', 'createdAt'] as const
type ValidSortKey = (typeof VALID_SORT_KEYS)[number]
const isValidSortKey = (v: string | null): v is ValidSortKey =>
  VALID_SORT_KEYS.includes(v as ValidSortKey)

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

  const rawSortBy = urlSearchParams.get('sortBy')
  const sortBy: ValidSortKey | undefined =
    rawSortBy && isValidSortKey(rawSortBy) ? rawSortBy : undefined
  const rawSortOrder = urlSearchParams.get('sortOrder')
  const sortOrder: 'asc' | 'desc' | undefined =
    rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : undefined

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
