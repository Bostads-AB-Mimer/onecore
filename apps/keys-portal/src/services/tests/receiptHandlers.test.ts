import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { KeyDetails, Card, Lease } from '@/services/types'

import {
  categorizeKeys,
  categorizeCards,
  assembleReturnReceipt,
  assembleMaintenanceLoanReceipt,
} from '../receiptHandlers'
import { keyLoanService } from '../api/keyLoanService'
import { fetchContactByContactCode } from '../api/contactService'

vi.mock('../api/receiptService', () => ({
  receiptService: {},
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

describe('assembleReturnReceipt', () => {
  it('returns undefined for missingKeys/disposedKeys/cards when all keys returned and no cards', () => {
    const keys = [makeKey({ id: 'k1' })]

    const result = assembleReturnReceipt(keys, new Set(['k1']), makeLease())

    expect(result.keys).toHaveLength(1)
    expect(result.missingKeys).toBeUndefined()
    expect(result.disposedKeys).toBeUndefined()
    expect(result.cards).toBeUndefined()
    expect(result.missingCards).toBeUndefined()
    expect(result.receiptType).toBe('RETURN')
    expect(result.operationDate).toBeInstanceOf(Date)
  })

  it('populates all fields for partial return with disposed keys, cards, and comment', () => {
    const keys = [
      makeKey({ id: 'k1' }), // returned
      makeKey({ id: 'k2' }), // missing (not selected)
      makeKey({ id: 'k3', disposed: true }), // disposed
    ]
    const cards = [
      makeCard({ cardId: 'c1' }), // returned
      makeCard({ cardId: 'c2' }), // missing
    ]

    const result = assembleReturnReceipt(
      keys,
      new Set(['k1']),
      makeLease(),
      cards,
      new Set(['c1']),
      'Test comment'
    )

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
