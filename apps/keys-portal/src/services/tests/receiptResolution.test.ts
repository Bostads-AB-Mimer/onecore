import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Lease } from '@/services/types'

import {
  categorizeKeys,
  categorizeCards,
  resolveBorrowers,
  resolveObjectOptions,
  pickAutoContract,
  resolveScopeByKeyId,
} from '../loans/receiptResolution'
import { fetchContactByContactCode } from '../api/contactService'
import { fetchLeasesByRentalPropertyId } from '../api/leaseSearchService'
import { rentalObjectSearchService } from '../api/rentalObjectSearchService'
import {
  makeKey,
  makeCard,
  makeTenant,
  makeContact,
  makeLease,
} from './fixtures'

vi.mock('../api/contactService', () => ({
  fetchContactByContactCode: vi.fn(),
}))

vi.mock('../api/leaseSearchService', () => ({
  fetchLeasesByRentalPropertyId: vi.fn(),
}))

vi.mock('../api/rentalObjectSearchService', () => ({
  rentalObjectSearchService: {
    getAddressesByRentalIds: vi.fn().mockResolvedValue({}),
    getAddressByRentalId: vi
      .fn()
      .mockResolvedValue('Testgatan 1, 722 12 Västerås'),
  },
}))

describe('categorizeKeys', () => {
  it('puts a disposed key in disposed even if selected', () => {
    const keys = [makeKey({ id: 'k1', disposed: true })]
    const result = categorizeKeys(keys, new Set(['k1']))

    expect(result.disposed).toHaveLength(1)
    expect(result.disposed[0].id).toBe('k1')
    expect(result.returned).toHaveLength(0)
    expect(result.missing).toHaveLength(0)
  })

  it('correctly buckets a mix of returned, missing, and disposed keys', () => {
    const keys = [
      makeKey({ id: 'k1', disposed: false }),
      makeKey({ id: 'k2', disposed: false }),
      makeKey({ id: 'k3', disposed: true }),
    ]
    const result = categorizeKeys(keys, new Set(['k1']))

    expect(result.returned.map((k) => k.id)).toEqual(['k1'])
    expect(result.missing.map((k) => k.id)).toEqual(['k2'])
    expect(result.disposed.map((k) => k.id)).toEqual(['k3'])
  })
})

describe('categorizeCards', () => {
  it('puts selected cards in returned and non-selected in missing', () => {
    const cards = [makeCard({ cardId: 'c1' }), makeCard({ cardId: 'c2' })]
    const result = categorizeCards(cards, new Set(['c1']))

    expect(result.returned.map((c) => c.cardId)).toEqual(['c1'])
    expect(result.missing.map((c) => c.cardId)).toEqual(['c2'])
  })
})

describe('resolveBorrowers', () => {
  beforeEach(() => {
    vi.mocked(fetchContactByContactCode).mockReset()
  })

  it('reuses a matching knownTenant without calling the contact API', async () => {
    const tenant = makeTenant({ contactCode: 'P001', fullName: 'Anna A' })

    const result = await resolveBorrowers({ contact: 'P001' }, [tenant])

    expect(result).toEqual([tenant])
    expect(fetchContactByContactCode).not.toHaveBeenCalled()
  })

  it('matches a knownTenant case-insensitively', async () => {
    const tenant = makeTenant({ contactCode: 'P001' })

    const result = await resolveBorrowers({ contact: 'p001' }, [tenant])

    expect(result[0].contactCode).toBe('P001')
    expect(fetchContactByContactCode).not.toHaveBeenCalled()
  })

  it('fetches the real borrower via API when not on the lease (the bug case)', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P999', fullName: 'Bob B' })
    )
    const leaseTenant = makeTenant({ contactCode: 'P001', fullName: 'Anna A' })

    const result = await resolveBorrowers({ contact: 'P999' }, [leaseTenant])

    expect(fetchContactByContactCode).toHaveBeenCalledWith('P999')
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('Bob B')
    expect(result[0].contactCode).toBe('P999')
  })

  it('resolves entirely via API when no knownTenants are provided', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001', fullName: 'Anna A' })
    )

    const result = await resolveBorrowers({ contact: 'P001' })

    expect(fetchContactByContactCode).toHaveBeenCalledWith('P001')
    expect(result[0].fullName).toBe('Anna A')
  })

  it('resolves both contact and contact2 in loan order', async () => {
    const a = makeTenant({ contactCode: 'P001', fullName: 'Anna' })
    const b = makeTenant({ contactCode: 'P002', fullName: 'Bo' })

    const result = await resolveBorrowers(
      { contact: 'P001', contact2: 'P002' },
      [a, b]
    )

    expect(result.map((t) => t.contactCode)).toEqual(['P001', 'P002'])
  })

  it('dedupes when contact and contact2 are the same code', async () => {
    const a = makeTenant({ contactCode: 'P001' })

    const result = await resolveBorrowers(
      { contact: 'P001', contact2: 'P001' },
      [a]
    )

    expect(result).toHaveLength(1)
  })

  it('throws (blocks printing) when a contact code cannot be resolved', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(null)

    await expect(resolveBorrowers({ contact: 'P404' })).rejects.toThrow()
  })

  it('throws when the loan has no contact codes', async () => {
    await expect(
      resolveBorrowers({ contact: null, contact2: null })
    ).rejects.toThrow()
  })
})

describe('resolveObjectOptions', () => {
  beforeEach(() => {
    vi.mocked(fetchLeasesByRentalPropertyId).mockReset().mockResolvedValue([])
  })

  it('returns one option per distinct object with its contact-matched leases', async () => {
    vi.mocked(fetchLeasesByRentalPropertyId).mockImplementation(async (id) =>
      id === 'OBJ-1'
        ? [
            makeLease({
              leaseId: 'L-1',
              rentalPropertyId: 'OBJ-1',
              tenants: [makeTenant({ contactCode: 'P001' })],
            }),
            makeLease({
              leaseId: 'L-X',
              rentalPropertyId: 'OBJ-1',
              tenants: [makeTenant({ contactCode: 'P999' })],
            }),
          ]
        : [
            makeLease({
              leaseId: 'L-2',
              rentalPropertyId: 'OBJ-2',
              tenants: [makeTenant({ contactCode: 'P001' })],
            }),
          ]
    )

    const result = await resolveObjectOptions({
      contact: 'P001',
      contact2: null,
      keysArray: [
        makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' }),
        makeKey({ id: 'k2', rentalObjectCode: 'OBJ-2' }),
      ],
    })

    expect(result.map((o) => o.rentalPropertyId)).toEqual(['OBJ-1', 'OBJ-2'])
    expect(result[0].matches.map((l) => l.leaseId)).toEqual(['L-1'])
    expect(result[1].matches.map((l) => l.leaseId)).toEqual(['L-2'])
  })

  it('dedupes keys that share an object', async () => {
    const result = await resolveObjectOptions({
      contact: 'P001',
      contact2: null,
      keysArray: [
        makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' }),
        makeKey({ id: 'k2', rentalObjectCode: 'OBJ-1' }),
      ],
    })

    expect(result).toHaveLength(1)
    expect(fetchLeasesByRentalPropertyId).toHaveBeenCalledTimes(1)
  })

  it('returns [] when keys carry no object', async () => {
    const result = await resolveObjectOptions({
      contact: 'P001',
      contact2: null,
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: null })],
    })

    expect(result).toEqual([])
    expect(fetchLeasesByRentalPropertyId).not.toHaveBeenCalled()
  })

  it('matches on contact2 and is case-insensitive', async () => {
    vi.mocked(fetchLeasesByRentalPropertyId).mockResolvedValue([
      makeLease({
        leaseId: 'L-1',
        rentalPropertyId: 'OBJ-1',
        tenants: [makeTenant({ contactCode: 'P002' })],
      }),
    ])

    const result = await resolveObjectOptions({
      contact: 'P001',
      contact2: 'p002',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
    })

    expect(result[0].matches.map((l) => l.leaseId)).toEqual(['L-1'])
  })
})

describe('pickAutoContract', () => {
  const opt = (rentalPropertyId: string, leaseIds: string[]) => ({
    rentalPropertyId,
    address: `addr-${rentalPropertyId}`,
    matches: leaseIds.map((leaseId) => ({ leaseId }) as Lease),
  })

  it('single object: uses it; lease only on a single match', () => {
    expect(pickAutoContract([opt('OBJ-1', ['L-1'])])).toEqual({
      rentalPropertyId: 'OBJ-1',
      address: 'addr-OBJ-1',
      leaseDisplayId: 'L-1',
    })
  })

  it('single object, no matching lease: object/address shown, lease blank', () => {
    const r = pickAutoContract([opt('OBJ-1', [])])
    expect(r.rentalPropertyId).toBe('OBJ-1')
    expect(r.address).toBe('addr-OBJ-1')
    expect(r.leaseDisplayId).toBeUndefined()
  })

  it('single object, multiple matches: object shown, lease blank', () => {
    const r = pickAutoContract([opt('OBJ-1', ['L-1', 'L-2'])])
    expect(r.rentalPropertyId).toBe('OBJ-1')
    expect(r.leaseDisplayId).toBeUndefined()
  })

  it('multi-object: uses the one object that uniquely has a matching lease', () => {
    expect(pickAutoContract([opt('OBJ-1', []), opt('OBJ-2', ['L-2'])])).toEqual(
      {
        rentalPropertyId: 'OBJ-2',
        address: 'addr-OBJ-2',
        leaseDisplayId: 'L-2',
      }
    )
  })

  it('multi-object: blanks everything when several objects match', () => {
    const r = pickAutoContract([opt('OBJ-1', ['L-1']), opt('OBJ-2', ['L-2'])])
    expect(r.rentalPropertyId).toBeUndefined()
    expect(r.address).toBeNull()
    expect(r.leaseDisplayId).toBeUndefined()
  })

  it('multi-object: blanks everything when none match', () => {
    const r = pickAutoContract([opt('OBJ-1', []), opt('OBJ-2', [])])
    expect(r.rentalPropertyId).toBeUndefined()
    expect(r.leaseDisplayId).toBeUndefined()
  })
})

describe('resolveScopeByKeyId', () => {
  beforeEach(() => {
    vi.mocked(rentalObjectSearchService.getAddressesByRentalIds)
      .mockReset()
      .mockResolvedValue({})
  })

  it('maps a key to its object address, and an HN master key to its keySystem name', async () => {
    vi.mocked(
      rentalObjectSearchService.getAddressesByRentalIds
    ).mockResolvedValue({ 'OBJ-1': 'Storgatan 5' })
    const keys = [
      makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' }),
      makeKey({
        id: 'k2',
        rentalObjectCode: null,
        keySystem: { name: 'HN-System' },
      } as never),
    ]

    const result = await resolveScopeByKeyId(keys)

    expect(result['k1']).toBe('Storgatan 5')
    expect(result['k2']).toBe('HN-System')
  })

  it('falls back to "-" when neither address nor keySystem name is available', async () => {
    const keys = [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })]

    const result = await resolveScopeByKeyId(keys)

    expect(result['k1']).toBe('-')
  })
})
