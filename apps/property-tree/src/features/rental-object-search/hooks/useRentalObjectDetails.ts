import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { RentalObjectDetails } from '@/services/api/core/propertyTreeService'
import { propertyTreeService } from '@/services/api/core/propertyTreeService'

import type { RentalObjectScopes } from '../model/scopes'
import { hasAnyScope } from '../model/scopes'

export type { RentalObjectDetails }

// Rent and comments change more often than the hierarchy does, so these get a
// shorter life than the structure's ten minutes.
const DETAILS_STALE_TIME = 5 * 60 * 1000

const EMPTY: ReadonlyMap<string, RentalObjectDetails> = new Map()

/**
 * Grundhyra, BRA, annan information och anläggnings-ID keyed by rental id, for
 * the same scope the listing searches — the server widens it to whole
 * properties, since its cache is keyed per property. Whole scope rather than
 * the drawn page, because a sort on rent needs every value in it; the map
 * covering objects the filters hide is harmless, as lookup is by rental id.
 * Only this listing mounts the hook, so the tree and the picker never hold it.
 */
export function useRentalObjectDetails(
  scopes: RentalObjectScopes
): ReadonlyMap<string, RentalObjectDetails> {
  const query = useQuery({
    queryKey: ['rentalObjectDetails', scopes],
    queryFn: () => propertyTreeService.getRentalObjectDetails(scopes),
    enabled: hasAnyScope(scopes),
    staleTime: DETAILS_STALE_TIME,
    gcTime: DETAILS_STALE_TIME,
  })

  // Stable identity: the column memos and the table below rebuild on it.
  return useMemo(
    () =>
      query.data
        ? new Map(query.data.map((d) => [d.rentalId, d] as const))
        : EMPTY,
    [query.data]
  )
}
