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
 * Returns array of full contact objects.
 * @param query - Search query string
 * @param contactType - Optional filter: 'company' for F-codes, 'person' for P-codes
 */
export async function searchContacts(
  query: string,
  contactType?: 'company' | 'person'
): Promise<Contact[]> {
  if (!query.trim()) return []

  // Strip hyphen from Swedish personal numbers (YYYYMMDD-XXXX or YYMMDD-XXXX)
  let q = query.trim()
  if (/^\d{6,8}-\d{0,4}$/.test(q)) {
    q = q.replace('-', '')
  }

  const { data, error } = await GET('/contacts/search', {
    params: {
      query: {
        q,
        ...(contactType && { contactType }),
      },
    },
  })

  if (error || !data) return []

  // The API wraps the results in a 'content' field
  const response = data as any
  return response?.content ?? []
}
