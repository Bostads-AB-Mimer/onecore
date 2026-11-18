import { Lease, leasing } from '@onecore/types'
import type { Contact } from '@onecore/contacts/domain'
import { logger } from '@onecore/utilities'
import z from 'zod'

import { contactsAdapter } from '../../../adapters/contacts-adapter'
import { AdapterResult } from '../../../adapters/types'
import {
  isRedactedProtectedIdentity,
  revealProtectedTenants,
} from '../../../processes/contacts/protected-tenants'
import { errorLogFields } from '../../../utils/error-log'
import { Lease as LeaseSchema, mapLease } from '../schemas/lease'

type LeaseResponse = z.infer<typeof LeaseSchema>
export type LeaseTenant = NonNullable<LeaseResponse['tenants']>[number]

export type LeaseTenantDeps = {
  contacts: Pick<typeof contactsAdapter, 'getByContactCodeBatch'>
  revealProtectedTenants: (contacts: Contact[]) => Promise<Contact[]>
}

const defaultDeps: LeaseTenantDeps = {
  contacts: contactsAdapter,
  revealProtectedTenants: (contacts) => revealProtectedTenants(contacts),
}

const toLeaseTenantAddress = (
  address: Contact['addresses'][number] | undefined
): LeaseTenant['address'] => {
  if (!address) return undefined
  return {
    street: address.street ?? undefined,
    // The contacts service keeps the street number in `street`.
    number: '',
    postalCode: address.zipCode ?? '',
    city: address.city ?? '',
  }
}

/** Null for a missing or unparseable date, so one bad value hides only itself. */
const toBirthDate = (value: string | null): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Maps a contact from the contacts service to the tenant shape of the lease
 * routes. A protected identity the contacts service redacted gets empty
 * identity fields and `protectedIdentityDetails: 'withheld'` — never the
 * service's `'redacted'` placeholder, which clients would show as a name.
 */
export const toLeaseTenant = (
  contact: Contact,
  isTenant: boolean
): LeaseTenant => {
  const { phoneNumbers, emailAddresses, specialAttention } =
    contact.communication
  const email = emailAddresses.find((e) => e.isPrimary) ?? emailAddresses[0]

  const shared = {
    contactCode: contact.contactCode,
    contactKey: contact.contactKey,
    address: toLeaseTenantAddress(contact.addresses[0]),
    phoneNumbers: phoneNumbers.map((p) => ({
      phoneNumber: p.phoneNumber,
      type: p.type,
      isMainNumber: p.isPrimary,
    })),
    emailAddress: email?.emailAddress ?? null,
    isTenant,
    specialAttention,
    protectedIdentity: contact.protectedIdentity,
  }

  if (contact.type === 'organisation') {
    return {
      ...shared,
      firstName: null,
      lastName: null,
      fullName: contact.organisation.name,
      nationalRegistrationNumber: contact.organisation.organisationNumber,
      birthDate: null,
    }
  }

  if (isRedactedProtectedIdentity(contact)) {
    return {
      ...shared,
      firstName: null,
      lastName: null,
      fullName: null,
      // Required by the schema, so empty rather than null.
      nationalRegistrationNumber: '',
      birthDate: null,
      protectedIdentityDetails: 'withheld',
    }
  }

  const { personal } = contact

  return {
    ...shared,
    firstName: personal.firstName,
    lastName: personal.lastName,
    fullName: personal.fullName,
    // Required by the schema; a contact without a national id gets ''.
    nationalRegistrationNumber: personal.nationalId ?? '',
    birthDate: toBirthDate(personal.birthDate),
    ...(contact.protectedIdentity
      ? { protectedIdentityDetails: 'shown' as const }
      : {}),
  }
}

const trimmedCodes = (codes: (string | undefined)[]): string[] =>
  codes.flatMap((code) => (code?.trim() ? [code.trim()] : []))

// Xpand compares contact codes ignoring case and trailing blanks, so the
// contacts service finds 'P123456' for 'p123456 '. Match the same way here.
const codeKey = (code: string): string => code.trim().toUpperCase()

/**
 * Maps leases to the lease routes' response shape with their tenants filled
 * in from the contacts service — the only source allowed to decide what of a
 * protected identity may be shown. Redaction is lifted for protected
 * identities that are tenants (see `revealProtectedTenants`); the rest are
 * returned redacted.
 *
 * All contacts are fetched in one batch. A first-hand tenant missing from the
 * contacts service fails the lookup; a missing sublet tenant is left out.
 */
export const mapLeasesWithTenants = async (
  leases: Lease[],
  overrides: Partial<LeaseTenantDeps> = {}
): Promise<AdapterResult<LeaseResponse[], 'no-contact' | 'unknown'>> => {
  const deps = { ...defaultDeps, ...overrides }

  const codes = [
    ...new Map(
      leases
        .flatMap((lease) =>
          trimmedCodes([
            ...(lease.tenantContactIds ?? []),
            lease.subletContactId,
          ])
        )
        .map((code) => [codeKey(code), code])
    ).values(),
  ]

  const byCode = new Map<string, Contact>()
  if (codes.length > 0) {
    try {
      const result = await deps.contacts.getByContactCodeBatch(codes, {
        includePhone: true,
        includeEmail: true,
        includeAddress: true,
      })
      if (!result.ok) {
        logger.error(
          { status: result.statusCode, error: result.err },
          'mapLeasesWithTenants.contactLookupFailed'
        )
        return { ok: false, err: 'unknown' }
      }

      const contacts = await deps.revealProtectedTenants(result.data)
      for (const contact of contacts) {
        byCode.set(codeKey(contact.contactCode), contact)
      }
    } catch (err: unknown) {
      logger.error(
        errorLogFields(err),
        'mapLeasesWithTenants.contactLookupThrew'
      )
      return { ok: false, err: 'unknown' }
    }
  }

  const mapped: LeaseResponse[] = []

  for (const lease of leases) {
    const tenants: LeaseTenant[] = []

    for (const contactCode of trimmedCodes(lease.tenantContactIds ?? [])) {
      const contact = byCode.get(codeKey(contactCode))
      if (!contact) {
        // The code comes from the lease, so the contact is expected to exist.
        logger.error(
          { contactCode, leaseId: lease.leaseId },
          'mapLeasesWithTenants.tenantContactNotFound'
        )
        return { ok: false, err: 'no-contact' }
      }
      // As in leasing: holding a lease, current or not, makes a tenant.
      tenants.push(toLeaseTenant(contact, true))
    }

    const [subletContactCode] = trimmedCodes([lease.subletContactId])
    if (subletContactCode) {
      const contact = byCode.get(codeKey(subletContactCode))
      if (contact) {
        const leaseContactType: leasing.v1.LeaseContactType = 'subletTenant'
        // A sublet tenant does not hold the lease.
        tenants.push({ ...toLeaseTenant(contact, false), leaseContactType })
      } else {
        logger.error(
          { contactCode: subletContactCode, leaseId: lease.leaseId },
          'mapLeasesWithTenants.subletContactNotFound'
        )
      }
    }

    mapped.push({ ...mapLease(lease), tenants })
  }

  return { ok: true, data: mapped }
}
