import { useQueries, useQuery } from '@tanstack/react-query'

import type {
  KvvAreaLocation,
  PropertyKvvAreaLookup,
} from '@/services/api/core'
import { propertyService } from '@/services/api/core'

const STALE_TIME = 5 * 60 * 1000

const queryOptions = (location: KvvAreaLocation) => ({
  queryKey: ['kvvAreaResolve', location],
  queryFn: () => propertyService.resolveKvvArea(location),
  staleTime: STALE_TIME,
})

export function useKvvArea(location: KvvAreaLocation | undefined) {
  return useQuery({
    ...queryOptions(location ?? { propertyCode: '' }),
    enabled: !!location,
  })
}

/**
 * All distinct KVV-areas covering a property. A split property has a default
 * area plus building-level exceptions, so the property itself and each of its
 * buildings are resolved and de-duplicated by area.
 */
export function usePropertyKvvAreas(
  propertyCode: string | undefined,
  buildingCodes: string[]
) {
  const locations: KvvAreaLocation[] = propertyCode
    ? [
        { propertyCode },
        ...buildingCodes.map((buildingCode) => ({ buildingCode })),
      ]
    : []

  return useQueries({
    queries: locations.map(queryOptions),
    combine: (results) => {
      const seen = new Set<string>()
      const areas: PropertyKvvAreaLookup[] = []
      for (const { data } of results) {
        if (data && !seen.has(data.kvvArea.id)) {
          seen.add(data.kvvArea.id)
          areas.push(data)
        }
      }
      return {
        areas,
        isLoading: results.some((r) => r.isLoading),
        isError: results.some((r) => r.isError),
      }
    },
  })
}
