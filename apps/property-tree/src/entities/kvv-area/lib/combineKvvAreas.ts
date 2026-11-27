import type { PropertyKvvAreaLookup } from '@/services/api/core'

export type KvvAreasResult = {
  areas: PropertyKvvAreaLookup[]
  isLoading: boolean
  isError: boolean
}

type ResolveResult = {
  data: PropertyKvvAreaLookup | null | undefined
  isLoading: boolean
  isError: boolean
}

/**
 * Merges several location lookups into the distinct KVV-areas they resolve
 * to, keeping the order of the first hit (the property default comes first).
 * `isError` stays true when only some lookups failed, so callers can warn that
 * the list may be incomplete.
 */
export const combineKvvAreas = (results: ResolveResult[]): KvvAreasResult => {
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
}
