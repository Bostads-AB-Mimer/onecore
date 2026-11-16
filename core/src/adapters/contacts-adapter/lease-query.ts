import { leasing } from '@onecore/types'
import type { Contact } from '@onecore/contacts/domain'
import { logger } from '@onecore/utilities'
import { contactsAdapter } from './index'
import { LeaseQuery } from '../property-base-adapter/lease-query'

const PERSONNUMMER_PATTERN = /^(\d{10}|\d{6}-\d{4}|\d{12}|\d{8}-\d{4})$/

export type PersonnummerResolution =
  | { kind: 'not-personnummer' }
  | { kind: 'found'; contactCode: string }
  | { kind: 'not-found' }
  | { kind: 'failed' }

/**
 * If `q` is a personnummer, looks up its contact code in the contacts
 * service. A failed lookup is told apart from a personnummer with no
 * contact, so a caller can fail closed instead of searching on the number.
 * A lookup that throws is left to the caller.
 */
export async function resolvePersonnummer(
  q: string
): Promise<PersonnummerResolution> {
  if (!PERSONNUMMER_PATTERN.test(q)) return { kind: 'not-personnummer' }

  const contactResult = await contactsAdapter.getByNationalId(q)
  if (contactResult.ok) {
    return { kind: 'found', contactCode: contactResult.data.contactCode }
  }
  if (contactResult.err === 'not-found') return { kind: 'not-found' }

  // Without the number itself: it is the person's identity.
  logger.error(
    { status: contactResult.statusCode, error: contactResult.err },
    'resolvePersonnummer: contact lookup failed'
  )
  return { kind: 'failed' }
}

/**
 * If `q` is a personnummer, resolves it to the matching contact code so
 * lease queries can match it the same way they match names or codes.
 */
export async function resolvePersonnummerInQuery(
  query: LeaseQuery
): Promise<LeaseQuery> {
  const raw = query.q
  const q = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')

  const resolution = await resolvePersonnummer(q)
  if (resolution.kind !== 'found') return query

  return { ...query, q: resolution.contactCode }
}

type ContactCommunication = Pick<Contact, 'communication'>

/** The contact's primary email address, else its first, else null. */
export const primaryEmailAddress = ({
  communication,
}: ContactCommunication): string | null =>
  communication.emailAddresses.find((e) => e.isPrimary)?.emailAddress ??
  communication.emailAddresses[0]?.emailAddress ??
  null

/** The contact's primary phone number, else its first, else null. */
export const primaryPhoneNumber = ({
  communication,
}: ContactCommunication): string | null =>
  communication.phoneNumbers.find((p) => p.isPrimary)?.phoneNumber ??
  communication.phoneNumbers[0]?.phoneNumber ??
  null

// Defers to contacts-service when it has a record, including null — a
// protected contact is never omitted, only returned with empty fields.
// No record at all (not yet synced) keeps Tenfast's data; there's
// nothing to redact.
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

  const contactsResult = await contactsAdapter
    .getByContactCodeBatch(contactCodes, {
      includePhone: true,
      includeEmail: true,
    })
    .catch(
      (
        err
      ): Awaited<ReturnType<typeof contactsAdapter.getByContactCodeBatch>> => ({
        ok: false,
        err: 'unknown',
        detail: err instanceof Error ? err.message : undefined,
      })
    )
  if (!contactsResult.ok) {
    logger.error(
      { err: contactsResult.err, logContext },
      'enrichLeaseContacts: contact enrichment failed, redacting contact info'
    )
    return leases.map((lease) => ({
      ...lease,
      contacts: lease.contacts?.map((c) => ({
        ...c,
        email: null,
        phone: null,
      })),
    }))
  }

  const contactMap = new Map(
    contactsResult.data.map((c) => [
      c.contactCode.trim(),
      { email: primaryEmailAddress(c), phone: primaryPhoneNumber(c) },
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
