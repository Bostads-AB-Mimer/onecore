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
 * @param query - Search query string
 * @param contactType - Optional filter: 'company' for F-codes, 'person' for P-codes
 */
export async function searchContacts(
  query: string,
  contactType?: 'company' | 'person'
): Promise<
  Array<{
    contactCode: string
    fullName: string
    nationalRegistrationNumber: string
  }>
> {
  if (!query.trim()) return []

  const { data, error } = await GET('/contacts/search', {
    params: {
      query: {
        q: query.trim(),
        ...(contactType && { contactType }),
      },
    },
  })

  if (error || !data) return []

  // The API wraps the results in a 'content' field
  const response = data as any
  return response?.content ?? []
}
