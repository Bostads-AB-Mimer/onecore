import type { Contact } from '@/services/types'

import {
  rentalObjectSearchService,
  type RentalObjectSearchResult,
} from './rentalObjectSearchService'
import { searchContacts } from './contactService'

export type UnifiedSearchResult =
  | { type: 'rental'; data: RentalObjectSearchResult }
  | { type: 'contact'; data: Contact }

export async function searchAll(query: string): Promise<UnifiedSearchResult[]> {
  if (!query.trim() || query.trim().length < 3) return []

  const [rentalResults, contacts] = await Promise.all([
    rentalObjectSearchService.searchByQuery(query),
    searchContacts(query),
  ])

  return [
    ...rentalResults.map((r) => ({ type: 'rental' as const, data: r })),
    ...contacts.map((c) => ({ type: 'contact' as const, data: c })),
  ]
}
