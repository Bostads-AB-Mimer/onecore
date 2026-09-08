import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { RentalObjectSubtype } from '@/services/api/core/propertyTreeService'
import { propertyTreeService } from '@/services/api/core/propertyTreeService'

import type { RentalObjectType } from '../model/selection'

export type { RentalObjectSubtype }

/** Key used for a subtype everywhere it is filtered or stored: a code is only
 * unique within its object type. */
export const subtypeKey = (type: RentalObjectType, code: string) =>
  `${type}:${code}`

// Captions change about as often as the property structure does.
const SUBTYPE_STALE_TIME = 10 * 60 * 1000

export function useRentalObjectSubtypes() {
  const query = useQuery({
    queryKey: ['rentalObjectSubtypes'],
    queryFn: () => propertyTreeService.getSubtypes(),
    staleTime: SUBTYPE_STALE_TIME,
    gcTime: SUBTYPE_STALE_TIME,
  })

  const byType = useMemo(() => {
    const out = new Map<RentalObjectType, RentalObjectSubtype[]>()
    for (const subtype of query.data ?? []) {
      const list = out.get(subtype.type) ?? []
      list.push(subtype)
      out.set(subtype.type, list)
    }
    return out
  }, [query.data])

  /** subtypeKey → caption, for chips and row filtering. */
  const nameByKey = useMemo(() => {
    const out = new Map<string, string>()
    for (const s of query.data ?? []) {
      out.set(subtypeKey(s.type, s.code), s.name)
    }
    return out
  }, [query.data])

  return { subtypes: query.data ?? [], byType, nameByKey, ...query }
}
