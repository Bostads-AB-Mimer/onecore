import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { KeyDetails, Card, Lease, Tenant, Contact } from '@/services/types'
import { generateReturnReceiptBlob } from '@/lib/pdf-receipts'

import {
  categorizeKeys,
  categorizeCards,
  assembleReturnReceipt,
  assembleMaintenanceLoanReceipt,
  resolveLoanTenants,
  resolveLoanReceiptObjects,
  pickAutoReturnContract,
  prepareReceipt,
  buildReturnReceiptBlob,
} from '../receiptHandlers'
import { keyLoanService } from '../api/keyLoanService'
import { receiptService } from '../api/receiptService'
import { fetchContactByContactCode } from '../api/contactService'
import { fetchLeasesByRentalPropertyId } from '../api/leaseSearchService'

vi.mock('../api/receiptService', () => ({
  receiptService: {
    getById: vi.fn(),
  },
}))

vi.mock('@/lib/pdf-receipts', () => ({
  generateLoanReceiptBlob: vi.fn(),
  generateReturnReceiptBlob: vi.fn(),
  generateMaintenanceLoanReceiptBlob: vi.fn(),
  generateMaintenanceReturnReceiptBlob: vi.fn(),
}))

vi.mock('../api/keyLoanService', () => ({
  keyLoanService: {
    get: vi.fn(),
  },
}))

vi.mock('../api/contactService', () => ({
  fetchContactByContactCode: vi.fn(),
}))

vi.mock('../api/leaseSearchService', () => ({
  fetchLeasesByRentalPropertyId: vi.fn(),
}))

vi.mock('../api/rentalObjectSearchService', () => ({
  rentalObjectSearchService: {
    getAddressesByRentalIds: vi.fn().mockResolvedValue({}),
    getAddressByRentalId: vi.fn().mockResolvedValue('Testgatan 1, 722 12 Västerås'),
  },
}))

// --- Minimal fixtures ---

function makeKey(overrides: Partial<KeyDetails> & { id: string }): KeyDetails {
  return {
    keyName: 'test-key',
    keyType: 'LGH',
    disposed: false,
    ...overrides,
  } as KeyDetails
}

function makeCard(overrides: Partial<Card> & { cardId: string }): Card {
  return { ...overrides } as Card
}

function makeTenant(
  overrides: Partial<Tenant> & { contactCode: string }
): Tenant {
  return {
    contactKey: 'key-' + overrides.contactCode,
    firstName: 'First',
    lastName: 'Last',
    fullName: 'First Last',
    nationalRegistrationNumber: '199001011234',
    birthDate: '1990-01-01',
    isTenant: true,
    ...overrides,
  } as Tenant
}

function makeContact(
  overrides: Partial<Contact> & { contactCode: string }
): Contact {
  return {
    contactKey: 'key-' + overrides.contactCode,
    firstName: 'First',
    lastName: 'Last',
    fullName: 'First Last',
    nationalRegistrationNumber: '199001011234',
    birthDate: '1990-01-01',
    phoneNumbers: [],
    isTenant: true,
    ...overrides,
  } as Contact
}

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    leaseId: 'lease-1',
    leaseNumber: '01',
    leaseStartDate: '2025-01-01',
    status: 'Current',
    rentalPropertyId: 'prop-1',
    type: 'Bostadskontrakt',
    tenants: [],
    ...overrides,
  } as Lease
}

// --- Tests ---

describe('categorizeKeys', () => {
  it('puts a disposed key in disposed even if selected', () => {
    const keys = [makeKey({ id: 'k1', disposed: true })]
    const selected = new Set(['k1'])

    const result = categorizeKeys(keys, selected)

    expect(result.disposed).toHaveLength(1)
    expect(result.disposed[0].id).toBe('k1')
    expect(result.returned).toHaveLength(0)
    expect(result.missing).toHaveLength(0)
  })

  it('correctly buckets a mix of returned, missing, and disposed keys', () => {
    const keys = [
      makeKey({ id: 'k1', disposed: false }), // selected → returned
      makeKey({ id: 'k2', disposed: false }), // not selected → missing
      makeKey({ id: 'k3', disposed: true }), // disposed
    ]
    const selected = new Set(['k1'])

    const result = categorizeKeys(keys, selected)

    expect(result.returned).toHaveLength(1)
    expect(result.returned[0].id).toBe('k1')
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0].id).toBe('k2')
    expect(result.disposed).toHaveLength(1)
    expect(result.disposed[0].id).toBe('k3')
  })
})

describe('categorizeCards', () => {
  it('puts selected cards in returned and non-selected in missing', () => {
    const cards = [makeCard({ cardId: 'c1' }), makeCard({ cardId: 'c2' })]
    const selected = new Set(['c1'])

    const result = categorizeCards(cards, selected)

    expect(result.returned).toHaveLength(1)
    expect(result.returned[0].cardId).toBe('c1')
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0].cardId).toBe('c2')
  })
})

describe('resolveLoanTenants', () => {
  beforeEach(() => {
    vi.mocked(fetchContactByContactCode).mockReset()
  })

  it('reuses a matching knownTenant without calling the contact API', async () => {
    const tenant = makeTenant({ contactCode: 'P001', fullName: 'Anna A' })

    const result = await resolveLoanTenants({ contact: 'P001' }, [tenant])

    expect(result).toEqual([tenant])
    expect(fetchContactByContactCode).not.toHaveBeenCalled()
  })

  it('matches a knownTenant case-insensitively', async () => {
    const tenant = makeTenant({ contactCode: 'P001' })

    const result = await resolveLoanTenants({ contact: 'p001' }, [tenant])

    expect(result[0].contactCode).toBe('P001')
    expect(fetchContactByContactCode).not.toHaveBeenCalled()
  })

  it('fetches the real borrower via API when not on the lease (the bug case)', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P999', fullName: 'Bob B' })
    )
    const leaseTenant = makeTenant({ contactCode: 'P001', fullName: 'Anna A' })

    const result = await resolveLoanTenants({ contact: 'P999' }, [leaseTenant])

    expect(fetchContactByContactCode).toHaveBeenCalledWith('P999')
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('Bob B')
    expect(result[0].contactCode).toBe('P999')
  })

  it('resolves entirely via API when no knownTenants are provided', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001', fullName: 'Anna A' })
    )

    const result = await resolveLoanTenants({ contact: 'P001' })

    expect(fetchContactByContactCode).toHaveBeenCalledWith('P001')
    expect(result[0].fullName).toBe('Anna A')
  })

  it('resolves both contact and contact2 in loan order', async () => {
    const a = makeTenant({ contactCode: 'P001', fullName: 'Anna' })
    const b = makeTenant({ contactCode: 'P002', fullName: 'Bo' })

    const result = await resolveLoanTenants(
      { contact: 'P001', contact2: 'P002' },
      [a, b]
    )

    expect(result.map((t) => t.contactCode)).toEqual(['P001', 'P002'])
  })

  it('dedupes when contact and contact2 are the same code', async () => {
    const a = makeTenant({ contactCode: 'P001' })

    const result = await resolveLoanTenants(
      { contact: 'P001', contact2: 'P001' },
      [a]
    )

    expect(result).toHaveLength(1)
  })

  it('throws (blocks printing) when a contact code cannot be resolved', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(null)

    await expect(resolveLoanTenants({ contact: 'P404' })).rejects.toThrow()
  })

  it('throws when the loan has no contact codes', async () => {
    await expect(
      resolveLoanTenants({ contact: null, contact2: null })
    ).rejects.toThrow()
  })
})

describe('resolveLoanReceiptObjects', () => {
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

    const result = await resolveLoanReceiptObjects({
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
    const result = await resolveLoanReceiptObjects({
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
    const result = await resolveLoanReceiptObjects({
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

    const result = await resolveLoanReceiptObjects({
      contact: 'P001',
      contact2: 'p002',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
    })

    expect(result[0].matches.map((l) => l.leaseId)).toEqual(['L-1'])
  })
})

describe('pickAutoReturnContract', () => {
  const opt = (rentalPropertyId: string, leaseIds: string[]) => ({
    rentalPropertyId,
    address: `addr-${rentalPropertyId}`,
    matches: leaseIds.map((leaseId) => ({ leaseId }) as Lease),
  })

  it('single object: uses it; lease only on a single match', () => {
    expect(pickAutoReturnContract([opt('OBJ-1', ['L-1'])])).toEqual({
      rentalPropertyId: 'OBJ-1',
      address: 'addr-OBJ-1',
      leaseDisplayId: 'L-1',
    })
  })

  it('single object, no matching lease: object/address shown, lease blank', () => {
    const r = pickAutoReturnContract([opt('OBJ-1', [])])
    expect(r.rentalPropertyId).toBe('OBJ-1')
    expect(r.address).toBe('addr-OBJ-1')
    expect(r.leaseDisplayId).toBeUndefined()
  })

  it('single object, multiple matches: object shown, lease blank', () => {
    const r = pickAutoReturnContract([opt('OBJ-1', ['L-1', 'L-2'])])
    expect(r.rentalPropertyId).toBe('OBJ-1')
    expect(r.leaseDisplayId).toBeUndefined()
  })

  it('multi-object: uses the one object that uniquely has a matching lease', () => {
    expect(
      pickAutoReturnContract([opt('OBJ-1', []), opt('OBJ-2', ['L-2'])])
    ).toEqual({
      rentalPropertyId: 'OBJ-2',
      address: 'addr-OBJ-2',
      leaseDisplayId: 'L-2',
    })
  })

  it('multi-object: blanks everything when several objects match', () => {
    const r = pickAutoReturnContract([opt('OBJ-1', ['L-1']), opt('OBJ-2', ['L-2'])])
    expect(r.rentalPropertyId).toBeUndefined()
    expect(r.address).toBeNull()
    expect(r.leaseDisplayId).toBeUndefined()
  })

  it('multi-object: blanks everything when none match', () => {
    const r = pickAutoReturnContract([opt('OBJ-1', []), opt('OBJ-2', [])])
    expect(r.rentalPropertyId).toBeUndefined()
    expect(r.leaseDisplayId).toBeUndefined()
  })
})

describe('prepareReceipt', () => {
  beforeEach(() => {
    vi.mocked(keyLoanService.get).mockReset()
    vi.mocked(receiptService.getById).mockReset()
    vi.mocked(fetchLeasesByRentalPropertyId).mockReset().mockResolvedValue([])
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001' })
    )
  })

  it('builds a LOAN receipt from a loanId with one loan fetch and resolves matches', async () => {
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-1',
      contact: 'P001',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
      keyCardsArray: [],
    } as any)
    const lease = makeLease({
      leaseId: 'L-1',
      rentalPropertyId: 'OBJ-1',
      tenants: [makeTenant({ contactCode: 'P001' })],
    })
    vi.mocked(fetchLeasesByRentalPropertyId).mockResolvedValue([lease])

    const { receiptData, objectOptions } = await prepareReceipt({
      loanId: 'loan-1',
    })

    expect(receiptService.getById).not.toHaveBeenCalled()
    expect(keyLoanService.get).toHaveBeenCalledTimes(1)
    expect(receiptData.receiptType).toBe('LOAN')
    expect(receiptData.loanId).toBe('loan-1')
    expect(objectOptions.map((o) => o.rentalPropertyId)).toEqual(['OBJ-1'])
    expect(objectOptions[0].matches.map((l) => l.leaseId)).toEqual(['L-1'])
  })

  it('takes receiptType + loan from the receipt when given a receiptId', async () => {
    vi.mocked(receiptService.getById).mockResolvedValue({
      id: 'r-1',
      keyLoanId: 'loan-9',
      receiptType: 'RETURN',
    } as any)
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-9',
      contact: 'P001',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
      keyCardsArray: [],
    } as any)

    const { receiptData } = await prepareReceipt({ receiptId: 'r-1' })

    expect(receiptService.getById).toHaveBeenCalledWith('r-1')
    expect(keyLoanService.get).toHaveBeenCalledTimes(1)
    expect(receiptData.receiptType).toBe('RETURN')
    expect(receiptData.loanId).toBe('loan-9')
  })
})

describe('buildReturnReceiptBlob', () => {
  it('assembles then renders, passing the loan-derived borrower to the PDF', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001', fullName: 'Anna A' })
    )
    vi.mocked(generateReturnReceiptBlob).mockResolvedValue({
      blob: {} as Blob,
      fileName: 'return.pdf',
    })

    const result = await buildReturnReceiptBlob({
      loan: { contact: 'P001' },
      loanKeys: [makeKey({ id: 'k1' })],
      selectedKeyIds: new Set(['k1']),
    })

    expect(generateReturnReceiptBlob).toHaveBeenCalledTimes(1)
    const rendered = vi.mocked(generateReturnReceiptBlob).mock.calls[0][0]
    expect(rendered.receiptType).toBe('RETURN')
    expect(rendered.tenants[0].fullName).toBe('Anna A')
    expect(result.fileName).toBe('return.pdf')
  })
})

describe('assembleReturnReceipt', () => {
  beforeEach(() => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001' })
    )
  })

  it('returns undefined for missingKeys/disposedKeys/cards when all keys returned and no cards', async () => {
    const keys = [makeKey({ id: 'k1' })]

    const result = await assembleReturnReceipt({
      loan: { contact: 'P001' },
      loanKeys: keys,
      selectedKeyIds: new Set(['k1']),
      leaseDisplayId: 'L-1',
    })

    expect(result.keys).toHaveLength(1)
    expect(result.missingKeys).toBeUndefined()
    expect(result.disposedKeys).toBeUndefined()
    expect(result.cards).toBeUndefined()
    expect(result.missingCards).toBeUndefined()
    expect(result.receiptType).toBe('RETURN')
    expect(result.operationDate).toBeInstanceOf(Date)
  })

  it('populates all fields for partial return with disposed keys, cards, and comment', async () => {
    const keys = [
      makeKey({ id: 'k1' }), // returned
      makeKey({ id: 'k2' }), // missing (not selected)
      makeKey({ id: 'k3', disposed: true }), // disposed
    ]
    const cards = [
      makeCard({ cardId: 'c1' }), // returned
      makeCard({ cardId: 'c2' }), // missing
    ]

    const result = await assembleReturnReceipt({
      loan: { contact: 'P001' },
      loanKeys: keys,
      selectedKeyIds: new Set(['k1']),
      leaseDisplayId: 'L-1',
      loanCards: cards,
      selectedCardIds: new Set(['c1']),
      comment: 'Test comment',
    })

    expect(result.keys).toHaveLength(1)
    expect(result.keys[0].id).toBe('k1')
    expect(result.missingKeys).toHaveLength(1)
    expect(result.missingKeys![0].id).toBe('k2')
    expect(result.disposedKeys).toHaveLength(1)
    expect(result.disposedKeys![0].id).toBe('k3')
    expect(result.cards).toHaveLength(1)
    expect(result.cards![0].cardId).toBe('c1')
    expect(result.missingCards).toHaveLength(1)
    expect(result.missingCards![0].cardId).toBe('c2')
    expect(result.comment).toBe('Test comment')
  })
})

describe('assembleMaintenanceLoanReceipt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses contact fullName, falls back to loan.contact, then to Unknown', async () => {
    const baseLoan = {
      id: 'loan-1',
      contact: 'F001',
      keysArray: [],
      keyCardsArray: [],
    }

    // Case 1: fullName available
    vi.mocked(keyLoanService.get).mockResolvedValue(baseLoan as any)
    vi.mocked(fetchContactByContactCode).mockResolvedValue({
      fullName: 'Acme Corp',
    } as any)
    const r1 = await assembleMaintenanceLoanReceipt('loan-1')
    expect(r1.contactName).toBe('Acme Corp')

    // Case 2: no fullName → falls back to loan.contact
    vi.mocked(fetchContactByContactCode).mockResolvedValue(null)
    const r2 = await assembleMaintenanceLoanReceipt('loan-1')
    expect(r2.contactName).toBe('F001')

    // Case 3: no contact at all → 'Unknown'
    vi.mocked(keyLoanService.get).mockResolvedValue({
      ...baseLoan,
      contact: null,
    } as any)
    const r3 = await assembleMaintenanceLoanReceipt('loan-1')
    expect(r3.contactName).toBe('Unknown')
    expect(r3.contact).toBe('Unknown')
  })

  it('merges description and comment with double newline, filters nulls', async () => {
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-1',
      contact: 'F001',
      notes: 'Loan description',
      keysArray: [],
      keyCardsArray: [],
    } as any)
    vi.mocked(fetchContactByContactCode).mockResolvedValue(null)

    // Both present → merged
    const r1 = await assembleMaintenanceLoanReceipt('loan-1', 'Extra comment')
    expect(r1.description).toBe('Loan description\n\nExtra comment')

    // Null description + no comment → undefined
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-2',
      contact: 'F001',
      notes: null,
      keysArray: [],
      keyCardsArray: [],
    } as any)
    const r2 = await assembleMaintenanceLoanReceipt('loan-2')
    expect(r2.description).toBeUndefined()
  })
})
