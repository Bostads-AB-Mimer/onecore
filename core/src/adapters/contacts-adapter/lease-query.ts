import { contactsAdapter } from './index'
import { LeaseQuery } from '../property-base-adapter/lease-query'

const PERSONNUMMER_PATTERN = /^(\d{10}|\d{6}-\d{4}|\d{12}|\d{8}-\d{4})$/

/**
 * If `q` is a personnummer, resolves it to the matching contact code so
 * lease queries can match it the same way they match names or codes.
 */
export async function resolvePersonnummerInQuery(
  query: LeaseQuery
): Promise<LeaseQuery> {
  const raw = query.q
  const q = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  if (!PERSONNUMMER_PATTERN.test(q)) return query

  const contactResult = await contactsAdapter.getByNationalId(q)
  if (!contactResult.ok) return query

  return { ...query, q: contactResult.data.contactCode }
}
