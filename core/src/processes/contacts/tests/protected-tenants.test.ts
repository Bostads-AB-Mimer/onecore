import { LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'
import type { Contact } from '@onecore/contacts/domain'
import {
  FINAL_INVOICE_GRACE_DAYS,
  isTenantOnLeases,
  ProtectedTenantDeps,
  revealProtectedTenant,
  revealProtectedTenants,
} from '../protected-tenants'
import * as factory from '../../../../test/factories'

const NOW = new Date('2026-11-10T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS)

// What the contacts service returns for a protected identity it redacts.
const redacted = (contactCode: string): Contact =>
  factory.contactsServiceContact.build({
    contactCode,
    contactKey: 'KEY',
    protectedIdentity: true,
    personal: {
      nationalId: 'redacted',
      birthDate: 'redacted',
      firstName: 'redacted',
      lastName: 'redacted',
      fullName: 'redacted',
    },
    communication: {
      phoneNumbers: [],
      emailAddresses: [],
      specialAttention: false,
    },
    addresses: [],
  })

const unredacted = (contactCode: string): Contact =>
  factory.contactsServiceContact.build({
    contactCode,
    contactKey: 'KEY',
    protectedIdentity: true,
  })

const makeDeps = (
  overrides: Partial<ProtectedTenantDeps> = {}
): ProtectedTenantDeps & {
  contacts: { getByContactCodeBatch: jest.Mock }
  leasesForContact: jest.Mock
} => ({
  contacts: {
    getByContactCodeBatch: jest.fn(async (codes: string[]) => ({
      ok: true as const,
      data: codes.map(unredacted),
    })),
  },
  leasesForContact: jest.fn().mockResolvedValue([factory.lease.build()]),
  now: () => NOW,
  ...(overrides as object),
})

describe('isTenantOnLeases', () => {
  it.each([
    LeaseStatus.Current,
    LeaseStatus.Upcoming,
    LeaseStatus.AboutToEnd,
    LeaseStatus.PreliminaryTerminated,
  ])('counts a lease with status %s', (status) => {
    expect(isTenantOnLeases([factory.lease.build({ status })], NOW)).toBe(true)
  })

  it.each([LeaseStatus.PendingSignature, LeaseStatus.NotSent])(
    'does not count a lease with status %s — not yet a tenant',
    (status) => {
      expect(isTenantOnLeases([factory.lease.build({ status })], NOW)).toBe(
        false
      )
    }
  )

  it('counts a lease that ended within the grace period', () => {
    const lease = factory.lease.build({
      status: LeaseStatus.Ended,
      leaseEndDate: daysAgo(FINAL_INVOICE_GRACE_DAYS - 1),
    })
    expect(isTenantOnLeases([lease], NOW)).toBe(true)
  })

  it('does not count a lease that ended before the grace period', () => {
    const lease = factory.lease.build({
      status: LeaseStatus.Ended,
      leaseEndDate: daysAgo(FINAL_INVOICE_GRACE_DAYS + 1),
      lastDebitDate: daysAgo(FINAL_INVOICE_GRACE_DAYS + 1),
    })
    expect(isTenantOnLeases([lease], NOW)).toBe(false)
  })

  it('uses the later of end date and last debit date, given as JSON strings', () => {
    const lease = factory.lease.build({
      status: LeaseStatus.Ended,
      leaseEndDate: daysAgo(90).toISOString() as unknown as Date,
      lastDebitDate: daysAgo(10).toISOString() as unknown as Date,
    })
    expect(isTenantOnLeases([lease], NOW)).toBe(true)
  })

  it('counts an ended lease with no dates, like an open-ended lease', () => {
    const lease = factory.lease.build({ status: LeaseStatus.Ended })
    expect(isTenantOnLeases([lease], NOW)).toBe(true)
  })

  it('is false for no leases', () => {
    expect(isTenantOnLeases([], NOW)).toBe(false)
  })
})

describe('revealProtectedTenants', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'error').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('looks nothing up when no contact is a redacted protected identity', async () => {
    const deps = makeDeps()
    const contacts = [
      factory.contactsServiceContact.build(),
      unredacted('P000888'),
    ]

    expect(await revealProtectedTenants(contacts, deps)).toBe(contacts)
    expect(deps.leasesForContact).not.toHaveBeenCalled()
    expect(deps.contacts.getByContactCodeBatch).not.toHaveBeenCalled()
  })

  it('replaces a redacted protected tenant, in place, keeping its relations', async () => {
    const deps = makeDeps()
    const other = factory.contactsServiceContact.build()
    const relatedContacts: Contact['relatedContacts'] = [
      {
        contactCode: 'P000111',
        role: 'trustee',
        fullName: 'Man God',
        firstName: 'God',
        lastName: 'Man',
      },
    ]
    const tenant = { ...redacted('P000999'), relatedContacts }

    const result = await revealProtectedTenants([other, tenant], deps)

    expect(deps.leasesForContact).toHaveBeenCalledWith('P000999')
    expect(deps.contacts.getByContactCodeBatch).toHaveBeenCalledWith(
      ['P000999'],
      {
        includePhone: true,
        includeEmail: true,
        includeAddress: true,
        verifiedTenants: true,
      }
    )
    expect(result[0]).toBe(other)
    expect(result[1]).toEqual({ ...unredacted('P000999'), relatedContacts })
    expect(
      result[1].type === 'individual' && result[1].personal.nationalId
    ).toBe('199001011234')
  })

  it('looks each code up once, matching padded codes', async () => {
    const deps = makeDeps()

    const result = await revealProtectedTenants(
      [redacted('P000999   '), redacted('P000999')],
      deps
    )

    expect(deps.leasesForContact).toHaveBeenCalledTimes(1)
    expect(deps.leasesForContact).toHaveBeenCalledWith('P000999')
    expect(
      result.every(
        (c) => c.type === 'individual' && c.personal.fullName !== 'redacted'
      )
    ).toBe(true)
  })

  it('keeps a protected identity without a tenant lease redacted', async () => {
    const deps = makeDeps({
      leasesForContact: jest.fn().mockResolvedValue([]),
    })
    const contacts = [redacted('P000999')]

    expect(await revealProtectedTenants(contacts, deps)).toBe(contacts)
    expect(deps.contacts.getByContactCodeBatch).not.toHaveBeenCalled()
  })

  it('fails closed when the lease lookup throws', async () => {
    const deps = makeDeps({
      leasesForContact: jest.fn().mockRejectedValue(new Error('Tenfast down')),
    })
    const contacts = [redacted('P000999')]

    expect(await revealProtectedTenants(contacts, deps)).toBe(contacts)
    expect(deps.contacts.getByContactCodeBatch).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCode: 'P000999',
        error: 'Tenfast down',
      }),
      'protectedTenants.leaseLookupFailed'
    )
  })

  it('fails closed when the lease lookup returns no array', async () => {
    const deps = makeDeps({
      leasesForContact: jest.fn().mockResolvedValue(undefined),
    })
    const contacts = [redacted('P000999')]

    expect(await revealProtectedTenants(contacts, deps)).toBe(contacts)
    expect(deps.contacts.getByContactCodeBatch).not.toHaveBeenCalled()
  })

  it('fails closed when the second contacts request fails', async () => {
    const deps = makeDeps({
      contacts: {
        getByContactCodeBatch: jest
          .fn()
          .mockResolvedValue({ ok: false, err: 'unknown' }),
      },
    })
    const contacts = [redacted('P000999')]

    expect(await revealProtectedTenants(contacts, deps)).toBe(contacts)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ contactCodes: ['P000999'] }),
      'protectedTenants.contactLookupFailed'
    )
  })

  it('fails closed when the second contacts request throws', async () => {
    const deps = makeDeps({
      contacts: {
        getByContactCodeBatch: jest
          .fn()
          .mockRejectedValue(new Error('timeout')),
      },
    })
    const contacts = [redacted('P000999')]

    expect(await revealProtectedTenants(contacts, deps)).toEqual(contacts)
  })

  it('keeps a contact redacted when the contacts service leaves it out', async () => {
    const deps = makeDeps({
      contacts: {
        getByContactCodeBatch: jest
          .fn()
          .mockResolvedValue({ ok: true, data: [] }),
      },
    })
    const contacts = [redacted('P000999')]

    expect(await revealProtectedTenants(contacts, deps)).toEqual(contacts)
  })
})

describe('revealProtectedTenant', () => {
  it('passes a failed result through untouched', async () => {
    const deps = makeDeps()
    const failed = { ok: false as const, err: 'not-found' as const }

    expect(await revealProtectedTenant(failed, deps)).toBe(failed)
    expect(deps.leasesForContact).not.toHaveBeenCalled()
  })

  it('reveals the contact of a successful result', async () => {
    const deps = makeDeps()

    const result = await revealProtectedTenant(
      { ok: true, data: redacted('P000999') },
      deps
    )

    expect(result).toEqual({ ok: true, data: unredacted('P000999') })
  })
})
