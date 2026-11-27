import { skipToken, useQueries, useQuery } from '@tanstack/react-query'

import { type KvvAreaResolveParams, kvvAreaService } from '@/services/api/core'

import { combineKvvAreas } from '../lib/combineKvvAreas'
import { KVV_AREA_RESOLVE_QUERY_KEY } from '../lib/queryKeys'

// Shared by the single-location and the property hook so a building page and
// the property page reuse the same cached building lookup.
const kvvAreaResolveQuery = (location: KvvAreaResolveParams) => ({
  queryKey: [KVV_AREA_RESOLVE_QUERY_KEY, location],
  queryFn: () => kvvAreaService.resolve(location),
})

/** KVV-area of one location (rental object or building). */
export const useKvvAreaResolve = (location: KvvAreaResolveParams | undefined) =>
  useQuery({
    queryKey: [KVV_AREA_RESOLVE_QUERY_KEY, location],
    queryFn: location ? () => kvvAreaService.resolve(location) : skipToken,
  })

/**
 * All distinct KVV-areas of a property. A split property has a default area
 * plus building-level exceptions, and resolving by property code only answers
 * the default, so each building is resolved as well.
 */
export const usePropertyKvvAreas = (
  propertyCode: string,
  buildingCodes: string[]
) =>
  useQueries({
    queries: [
      kvvAreaResolveQuery({ propertyCode }),
      ...buildingCodes.map((buildingCode) =>
        kvvAreaResolveQuery({ buildingCode })
      ),
    ],
    combine: combineKvvAreas,
  })
