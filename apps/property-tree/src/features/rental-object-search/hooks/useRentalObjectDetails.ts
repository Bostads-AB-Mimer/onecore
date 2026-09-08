import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { RentalObjectDetails } from '@/services/api/core/propertyTreeService'
import { propertyTreeService } from '@/services/api/core/propertyTreeService'

export type { RentalObjectDetails }

// Rent and comments change more often than the hierarchy does, so these get a
// shorter life than the structure's ten minutes.
const DETAILS_STALE_TIME = 5 * 60 * 1000

const EMPTY: ReadonlyMap<string, RentalObjectDetails> = new Map()

/**
 * Grundhyra, BRA, annan information och anläggnings-ID for the drawn page's
 * rows, keyed by rental id. Scoped by the page's rentalIds rather than the
 * applied selection — a district-wide scope shipped thousands of rows for a
 * 50-row page. A future sort on rent needs the whole scope back.
 *
 * Deferred plan: fold details into /rental-objects/search as an optional
 * includeDetails flag (route-level composition off the same details cache) —
 * page-scoped by construction, and this hook plus its endpoint disappear.
 */
export function useRentalObjectDetails(
  rentalIds: string[]
): ReadonlyMap<string, RentalObjectDetails> {
  const query = useQuery({
    queryKey: ['rentalObjectDetails', rentalIds],
    queryFn: () => propertyTreeService.getRentalObjectDetails({ rentalIds }),
    enabled: rentalIds.length > 0,
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
