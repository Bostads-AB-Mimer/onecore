import type { Contact } from '@/services/types'

import { GET } from './core/base-api'

/**
 * Fetches contact information by contact code.
 * The API returns { content: Contact, _links: ... }
 * We extract and return just the contact content.
 */
export async function fetchContactByContactCode(
  contactCode: string
): Promise<Contact | null> {
  const normalized = contactCode.trim().toUpperCase()

  const { data, error } = await GET('/contacts/{contactCode}', {
    params: { path: { contactCode: normalized } },
  })

  if (error || !data) return null

  // The API wraps the contact in a 'content' field
  const response = data as any
  return response?.content ?? null
}

/**
 * Search contacts by query string (name, contact code, or national registration number).
 * Returns array of contact suggestions with basic info.
 */
export async function searchContacts(query: string): Promise<
  Array<{
    contactCode: string
    fullName: string
    nationalRegistrationNumber: string
  }>
> {
  if (!query.trim()) return []

  const { data, error } = await GET('/contacts/search', {
    params: { query: { q: query.trim() } },
  })

  if (error || !data) return []

  // The API wraps the results in a 'content' field
  const response = data as any
  return response?.content ?? []
}
