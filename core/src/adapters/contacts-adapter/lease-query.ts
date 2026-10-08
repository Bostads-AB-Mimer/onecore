import { leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'
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

// Always defers to contacts-service's answer, including null, so a contact
// marked protected there can't be unmasked via Tenfast's own data.
export async function enrichLeaseContacts<
  T extends { contacts?: leasing.v1.ContactInfo[] },
>(leases: T[], logContext: string): Promise<T[]> {
  const contactCodes = [
    ...new Set(
      leases
        .flatMap((l) => l.contacts?.map((c) => c.contactCode) ?? [])
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    ),
  ]
  if (contactCodes.length === 0) return leases

  const contactsResult = await contactsAdapter.getByContactCodeBatch(
    contactCodes,
    { includePhone: true, includeEmail: true }
  )
  if (!contactsResult.ok) {
    logger.error(
      { err: contactsResult.err, logContext },
      'enrichLeaseContacts: contact enrichment failed, returning leases without contact info'
    )
    return leases
  }

  const contactMap = new Map(
    contactsResult.data.map((c) => [
      c.contactCode.trim(),
      {
        email:
          c.communication.emailAddresses.find((e) => e.isPrimary)
            ?.emailAddress ??
          c.communication.emailAddresses[0]?.emailAddress ??
          null,
        phone:
          c.communication.phoneNumbers.find((p) => p.isPrimary)?.phoneNumber ??
          c.communication.phoneNumbers[0]?.phoneNumber ??
          null,
      },
    ])
  )

  return leases.map((lease) => ({
    ...lease,
    contacts: lease.contacts?.map((c) => ({
      ...c,
      ...contactMap.get(c.contactCode.trim()),
    })),
  }))
}
