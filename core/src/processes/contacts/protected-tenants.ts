import { leasing, Lease, LeaseStatus } from '@onecore/types'
import type { Contact } from '@onecore/contacts/domain'
import { logger } from '@onecore/utilities'
import z from 'zod'

import { contactsAdapter } from '../../adapters/contacts-adapter'
import { getLeasesByContactCode } from '../../adapters/leasing-adapter/leases'
import { AdapterResult } from '../../adapters/types'
import { runWithConcurrency } from '../../utils/concurrency'
import { errorLogFields } from '../../utils/error-log'

/** The value the contacts service puts in every personal field it redacts. */
export const REDACTED = 'redacted'

/**
 * How long after a lease ends its holder still counts as a tenant, so that a
 * final invoice (slutavisering) can be sent with real name and address.
 */
export const FINAL_INVOICE_GRACE_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

// Leases on which the contact is a tenant. pending-signature and not-sent are
// left out: we only reveal people who have become tenants.
const TENANT_LEASE_STATUSES: z.infer<
  typeof leasing.v1.GetLeasesStatusSchema
>[] = ['current', 'upcoming', 'about-to-end', 'preliminary-terminated', 'ended']

const NOT_YET_TENANT = new Set([
  LeaseStatus.PendingSignature,
  LeaseStatus.NotSent,
])

// Tenfast calls are slow and this runs inside request paths, so cap how many
// lease lookups are in flight at once.
const LEASE_LOOKUP_CONCURRENCY = 5

export type ProtectedTenantDeps = {
  contacts: Pick<typeof contactsAdapter, 'getByContactCodeBatch'>
  leasesForContact: (contactCode: string) => Promise<Lease[]>
  now: () => Date
}

const defaultDeps: ProtectedTenantDeps = {
  contacts: contactsAdapter,
  leasesForContact: (contactCode) =>
    getLeasesByContactCode(contactCode, { status: TENANT_LEASE_STATUSES }),
  now: () => new Date(),
}

/** A protected individual the contacts service returned redacted. */
export const isRedactedProtectedIdentity = (contact: Contact): boolean =>
  contact.type === 'individual' &&
  contact.protectedIdentity &&
  contact.personal.fullName === REDACTED

/**
 * Whether the leases make their contact a tenant: any lease that is current,
 * upcoming or terminated but not yet ended, or one that ended at most
 * FINAL_INVOICE_GRACE_DAYS ago. A lease that is ended but has no end or last
 * debit date counts, like an open-ended lease.
 */
export const isTenantOnLeases = (leases: Lease[], now: Date): boolean => {
  const cutoff = now.getTime() - FINAL_INVOICE_GRACE_DAYS * DAY_MS

  return leases.some((lease) => {
    if (NOT_YET_TENANT.has(lease.status)) return false
    if (lease.status !== LeaseStatus.Ended) return true

    // Dates arrive as ISO strings over JSON despite the Date typing.
    const ends = [lease.leaseEndDate, lease.lastDebitDate]
      .filter((d): d is Date => d != null)
      .map((d) => new Date(d).getTime())
    return ends.length === 0 || Math.max(...ends) >= cutoff
  })
}

/** Fails closed: a failed lookup means "not a verified tenant". */
const isVerifiedTenant = async (
  contactCode: string,
  deps: ProtectedTenantDeps
): Promise<boolean> => {
  try {
    const leases = await deps.leasesForContact(contactCode)
    if (!Array.isArray(leases)) {
      logger.error(
        { contactCode },
        'protectedTenants.leaseLookupReturnedNoLeases'
      )
      return false
    }
    return isTenantOnLeases(leases, deps.now())
  } catch (err: unknown) {
    logger.error(
      { contactCode, ...errorLogFields(err) },
      'protectedTenants.leaseLookupFailed'
    )
    return false
  }
}

/**
 * Lifts redaction for protected identities that are tenants. Tenfast is the
 * master for leases, so core checks there and — for those with a lease — asks
 * the contacts service again with `verifiedTenants`, which returns them
 * unredacted (their data in Xpand is already anonymised). The contacts service
 * itself still exempts an annan fakturamottagare, from its own database.
 *
 * Only contacts the contacts service redacted are looked up, so contacts
 * without a protected identity cost nothing. Fails closed: if the lease
 * lookup or the second contacts request fails, the contact stays redacted.
 */
export const revealProtectedTenants = async (
  contacts: Contact[],
  overrides: Partial<ProtectedTenantDeps> = {}
): Promise<Contact[]> => {
  const deps = { ...defaultDeps, ...overrides }
  const codes = [
    ...new Set(
      contacts
        .filter(isRedactedProtectedIdentity)
        .map((c) => c.contactCode.trim())
    ),
  ]
  if (codes.length === 0) return contacts

  const tenancy = await runWithConcurrency(
    codes,
    async (code) => ({ code, isTenant: await isVerifiedTenant(code, deps) }),
    LEASE_LOOKUP_CONCURRENCY
  )
  const tenants = tenancy.filter((t) => t.isTenant).map((t) => t.code)
  if (tenants.length === 0) return contacts

  const result = await deps.contacts
    .getByContactCodeBatch(tenants, {
      includePhone: true,
      includeEmail: true,
      includeAddress: true,
      verifiedTenants: true,
    })
    .catch((err: unknown): AdapterResult<never, 'unknown'> => {
      logger.error(
        { contactCodes: tenants, ...errorLogFields(err) },
        'protectedTenants.contactLookupThrew'
      )
      return { ok: false, err: 'unknown' }
    })

  if (!result.ok) {
    logger.error(
      { contactCodes: tenants, err: result.err },
      'protectedTenants.contactLookupFailed'
    )
    return contacts
  }

  const revealed = new Map(result.data.map((c) => [c.contactCode.trim(), c]))

  return contacts.map((contact) => {
    const unredacted = isRedactedProtectedIdentity(contact)
      ? revealed.get(contact.contactCode.trim())
      : undefined
    if (!unredacted) return contact
    // Keep the relations the original request asked for (or left out).
    return { ...unredacted, relatedContacts: contact.relatedContacts }
  })
}

/** `revealProtectedTenants` for a single-contact adapter result. */
export const revealProtectedTenant = async <E>(
  result: AdapterResult<Contact, E>,
  overrides: Partial<ProtectedTenantDeps> = {}
): Promise<AdapterResult<Contact, E>> => {
  if (!result.ok) return result
  const [contact] = await revealProtectedTenants([result.data], overrides)
  return { ...result, data: contact }
}

/** `revealProtectedTenants` for a contact-list adapter result. */
export const revealProtectedTenantList = async <E>(
  result: AdapterResult<Contact[], E>,
  overrides: Partial<ProtectedTenantDeps> = {}
): Promise<AdapterResult<Contact[], E>> => {
  if (!result.ok) return result
  return {
    ...result,
    data: await revealProtectedTenants(result.data, overrides),
  }
}

/**
 * A contact lookup that reveals protected tenants, for processes that take a
 * `ContactLookup` (see `withProtectedIdentityDetails`).
 */
export const tenantAwareContactLookup = {
  getByContactCode: async (contactCode: string) =>
    revealProtectedTenant(await contactsAdapter.getByContactCode(contactCode)),
}
