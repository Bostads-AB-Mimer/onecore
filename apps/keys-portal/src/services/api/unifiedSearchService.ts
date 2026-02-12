import { GET } from './core/base-api'
import { searchContacts } from './contactService'
import type { components } from './core/generated/api-types'

type ResidenceSearchResult = components['schemas']['ResidenceSearchResult']
type ParkingSpaceSearchResult =
  components['schemas']['ParkingSpaceSearchResult']
type FacilitySearchResult = components['schemas']['FacilitySearchResult']
type Contact = components['schemas']['Contact']

export type UnifiedSearchResult =
  | { type: 'residence'; data: ResidenceSearchResult }
  | { type: 'parking-space'; data: ParkingSpaceSearchResult }
  | { type: 'facility'; data: FacilitySearchResult }
  | { type: 'contact'; data: Contact }

export async function searchAll(query: string): Promise<UnifiedSearchResult[]> {
  if (!query.trim() || query.trim().length < 3) return []

  const [residences, parkingSpaces, facilities, contacts] = await Promise.all([
    GET('/residences/search', {
      params: { query: { q: query } },
    }),
    GET('/parking-spaces/search', {
      params: { query: { q: query } },
    }),
    GET('/facilities/search', {
      params: { query: { q: query } },
    }),
    searchContacts(query),
  ])

  const results: UnifiedSearchResult[] = []

  for (const r of residences.data?.content ?? []) {
    results.push({ type: 'residence', data: r })
  }

  for (const p of parkingSpaces.data?.content ?? []) {
    results.push({ type: 'parking-space', data: p })
  }

  for (const f of facilities.data?.content ?? []) {
    results.push({ type: 'facility', data: f })
  }

  for (const c of contacts) {
    results.push({ type: 'contact', data: c })
  }

  return results
}
