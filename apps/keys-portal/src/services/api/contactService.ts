import type { Tenant } from '@/services/types'

import { GET } from './core/base-api'

/**
 * Fetch contact details by contact code
 * @param contactCode - The contact code (e.g., 'TC-001')
 * @returns The contact/tenant object or null if not found
 */
export async function fetchContactByCode(
  contactCode: string
): Promise<Tenant | null> {
  const { data, error } = await GET('/contacts/{contactCode}', {
    params: {
      path: { contactCode },
    },
  })
  if (error) return null
  return (data?.content as Tenant) ?? null
}

/**
 * Fetch multiple contacts by contact codes
 * @param contactCodes - Array of contact codes
 * @returns Array of contacts (filters out null results)
 */
export async function fetchContactsByCodes(
  contactCodes: string[]
): Promise<Tenant[]> {
  const results = await Promise.all(
    contactCodes.map((code) => fetchContactByCode(code))
  )
  return results.filter((contact): contact is Tenant => contact !== null)
}
