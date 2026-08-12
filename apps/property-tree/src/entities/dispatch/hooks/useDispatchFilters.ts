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
  'audienceDistrict',
  'audienceKvvArea',
  'audienceProperty',
  'audienceBuilding',
  'audienceParkingArea',
  'audienceStaircase',
  'audienceObjectTypes',
] as const

// URL key per audience-picker level; values map 1:1 to audience* search params.
const AUDIENCE_URL_KEYS = {
  district: 'audienceDistrict',
  kvvArea: 'audienceKvvArea',
  property: 'audienceProperty',
  building: 'audienceBuilding',
  parkingArea: 'audienceParkingArea',
  staircase: 'audienceStaircase',
  // Not a tree level: the picker's object-type filter dimension.
  objectType: 'audienceObjectTypes',
} as const

type AudiencePickerLevel = keyof typeof AUDIENCE_URL_KEYS

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

  const selectedAudienceDistricts = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.district),
    [urlSearchParams]
  )
  const selectedAudienceKvvAreas = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.kvvArea),
    [urlSearchParams]
  )
  const selectedAudienceProperties = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.property),
    [urlSearchParams]
  )
  const selectedAudienceBuildings = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.building),
    [urlSearchParams]
  )
  const selectedAudienceParkingAreas = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.parkingArea),
    [urlSearchParams]
  )
  const selectedAudienceStaircases = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.staircase),
    [urlSearchParams]
  )
  const selectedAudienceObjectTypes = useMemo(
    () => urlSearchParams.getAll(AUDIENCE_URL_KEYS.objectType),
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
      audienceDistrictNames:
        selectedAudienceDistricts.length > 0
          ? selectedAudienceDistricts
          : undefined,
      audienceKvvAreaCodes:
        selectedAudienceKvvAreas.length > 0
          ? selectedAudienceKvvAreas
          : undefined,
      audienceProperty:
        selectedAudienceProperties.length > 0
          ? selectedAudienceProperties
          : undefined,
      audienceBuildingCodes:
        selectedAudienceBuildings.length > 0
          ? selectedAudienceBuildings
          : undefined,
      audienceParkingAreaCodes:
        selectedAudienceParkingAreas.length > 0
          ? selectedAudienceParkingAreas
          : undefined,
      audienceStaircaseCodes:
        selectedAudienceStaircases.length > 0
          ? selectedAudienceStaircases
          : undefined,
      audienceObjectTypes:
        selectedAudienceObjectTypes.length > 0
          ? (selectedAudienceObjectTypes as DispatchSearchQueryParams['audienceObjectTypes'])
          : undefined,
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
      selectedAudienceDistricts,
      selectedAudienceKvvAreas,
      selectedAudienceProperties,
      selectedAudienceBuildings,
      selectedAudienceParkingAreas,
      selectedAudienceStaircases,
      selectedAudienceObjectTypes,
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

  // Union the picker's output into the active audience filter (the picker
  // always opens fresh, so applying adds to — never replaces — the chips).
  const { setFilterValues, setFilterValuesBatch } = filters
  const applyAudienceCriteria = useCallback(
    (criteria: {
      districtNames: string[]
      kvvAreaCodes: string[]
      property: string[]
      buildingCodes: string[]
      parkingAreaCodes: string[]
      staircaseCodes: string[]
      objectTypes: string[]
    }) => {
      const union = (current: string[], added: string[]) => [
        ...current,
        ...added.filter((v) => !current.includes(v)),
      ]
      setFilterValuesBatch({
        [AUDIENCE_URL_KEYS.district]: union(
          selectedAudienceDistricts,
          criteria.districtNames
        ),
        [AUDIENCE_URL_KEYS.kvvArea]: union(
          selectedAudienceKvvAreas,
          criteria.kvvAreaCodes
        ),
        [AUDIENCE_URL_KEYS.property]: union(
          selectedAudienceProperties,
          criteria.property
        ),
        [AUDIENCE_URL_KEYS.building]: union(
          selectedAudienceBuildings,
          criteria.buildingCodes
        ),
        [AUDIENCE_URL_KEYS.parkingArea]: union(
          selectedAudienceParkingAreas,
          criteria.parkingAreaCodes
        ),
        [AUDIENCE_URL_KEYS.staircase]: union(
          selectedAudienceStaircases,
          criteria.staircaseCodes
        ),
        // Absolute, not additive: the button group expresses the whole
        // restriction, and [] (= all types) clears it.
        [AUDIENCE_URL_KEYS.objectType]: criteria.objectTypes,
      })
    },
    [
      setFilterValuesBatch,
      selectedAudienceDistricts,
      selectedAudienceKvvAreas,
      selectedAudienceProperties,
      selectedAudienceBuildings,
      selectedAudienceParkingAreas,
      selectedAudienceStaircases,
    ]
  )

  const removeAudienceCriterion = useCallback(
    (level: AudiencePickerLevel, value: string) => {
      const key = AUDIENCE_URL_KEYS[level]
      setFilterValues(
        key,
        urlSearchParams.getAll(key).filter((v) => v !== value)
      )
    },
    [setFilterValues, urlSearchParams]
  )

  /** Clear every value of one audience level (grouped chip's ✕). */
  const removeAudienceLevel = useCallback(
    (level: AudiencePickerLevel) => {
      setFilterValues(AUDIENCE_URL_KEYS[level], [])
    },
    [setFilterValues]
  )

  const audienceChips = useMemo(
    () => [
      ...selectedAudienceDistricts.map((value) => ({
        level: 'district' as const,
        value,
      })),
      ...selectedAudienceKvvAreas.map((value) => ({
        level: 'kvvArea' as const,
        value,
      })),
      ...selectedAudienceProperties.map((value) => ({
        level: 'property' as const,
        value,
      })),
      ...selectedAudienceBuildings.map((value) => ({
        level: 'building' as const,
        value,
      })),
      ...selectedAudienceParkingAreas.map((value) => ({
        level: 'parkingArea' as const,
        value,
      })),
      ...selectedAudienceStaircases.map((value) => ({
        level: 'staircase' as const,
        value,
      })),
      ...selectedAudienceObjectTypes.map((value) => ({
        level: 'objectType' as const,
        value,
      })),
    ],
    [
      selectedAudienceDistricts,
      selectedAudienceKvvAreas,
      selectedAudienceProperties,
      selectedAudienceBuildings,
      selectedAudienceParkingAreas,
      selectedAudienceStaircases,
      selectedAudienceObjectTypes,
    ]
  )

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

    // Audience picker filter
    audienceChips,
    applyAudienceCriteria,
    removeAudienceCriterion,
    removeAudienceLevel,

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
