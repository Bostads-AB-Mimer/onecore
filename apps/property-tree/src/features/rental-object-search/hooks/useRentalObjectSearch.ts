import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { RentalObjectType } from '@/entities/property-tree'

import { propertyTreeService } from '@/services/api/core/propertyTreeService'

import type { RentalObjectScopes } from '../model/scopes'
import { hasAnyScope } from '../model/scopes'

export const RENTAL_OBJECT_PAGE_SIZE = 50

interface RentalObjectSearchArgs {
  scopes: RentalObjectScopes
  types: RentalObjectType[]
  /** `type:code` keys; [] = no subtype restriction. */
  subtypes: string[]
  page: number
}

/** Paginated rental-object search. Idle until a scope is chosen — the endpoint
 * requires one, and a district is thousands of objects. */
export function useRentalObjectSearch({
  scopes,
  types,
  subtypes,
  page,
}: RentalObjectSearchArgs) {
  const enabled = hasAnyScope(scopes)
  const query = useQuery({
    queryKey: ['rentalObjectSearch', scopes, types, subtypes, page],
    queryFn: () =>
      propertyTreeService.searchRentalObjects({
        ...scopes,
        types: types.length ? types : undefined,
        subtypes: subtypes.length ? subtypes : undefined,
        page,
        limit: RENTAL_OBJECT_PAGE_SIZE,
      }),
    enabled,
    // Paging shouldn't blank the table.
    placeholderData: keepPreviousData,
  })

  const totalCount = query.data?.totalCount ?? 0
  return {
    ...query,
    enabled,
    objects: query.data?.content ?? [],
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / RENTAL_OBJECT_PAGE_SIZE)),
  }
}
