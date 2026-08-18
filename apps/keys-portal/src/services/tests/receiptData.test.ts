import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  prepareReceipt,
  assembleReturnReceiptData,
  mergeComment,
} from '../loans/receiptData'
import { keyLoanService } from '../api/keyLoanService'
import { receiptService } from '../api/receiptService'
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

vi.mock('../api/receiptService', () => ({
  receiptService: { getById: vi.fn() },
}))
vi.mock('../api/keyLoanService', () => ({
  keyLoanService: { get: vi.fn() },
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
    getAddressByRentalId: vi.fn().mockResolvedValue('Testgatan 1'),
  },
}))

describe('mergeComment', () => {
  it('joins notes and comment with a blank line, dropping empties', () => {
    expect(mergeComment('notes', 'comment')).toBe('notes\n\ncomment')
    expect(mergeComment('notes', '')).toBe('notes')
    expect(mergeComment(null, 'comment')).toBe('comment')
    expect(mergeComment(null, null)).toBeUndefined()
  })
})

describe('prepareReceipt', () => {
  beforeEach(() => {
    vi.mocked(keyLoanService.get).mockReset()
    vi.mocked(receiptService.getById).mockReset()
    vi.mocked(fetchLeasesByRentalPropertyId).mockReset().mockResolvedValue([])
    vi.mocked(rentalObjectSearchService.getAddressesByRentalIds)
      .mockReset()
      .mockResolvedValue({})
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001' })
    )
  })

  it('builds a tenant LOAN receipt from a loanId with one fetch and resolves matches', async () => {
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-1',
      loanType: 'TENANT',
      contact: 'P001',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
      keyCardsArray: [],
    } as never)
    vi.mocked(fetchLeasesByRentalPropertyId).mockResolvedValue([
      makeLease({
        leaseId: 'L-1',
        rentalPropertyId: 'OBJ-1',
        tenants: [makeTenant({ contactCode: 'P001' })],
      }),
    ])

    const { receiptData, objectOptions } = await prepareReceipt({
      loanId: 'loan-1',
    })

    expect(receiptService.getById).not.toHaveBeenCalled()
    expect(keyLoanService.get).toHaveBeenCalledTimes(1)
    expect(receiptData.receiptType).toBe('LOAN')
    expect(receiptData.loanType).toBe('TENANT')
    expect(receiptData.contacts[0].contactCode).toBe('P001')
    expect(receiptData.scopeByKeyId).toBeUndefined()
    expect(objectOptions[0].matches.map((l) => l.leaseId)).toEqual(['L-1'])
  })

  it('takes receiptType + loan from the receipt when given a receiptId', async () => {
    vi.mocked(receiptService.getById).mockResolvedValue({
      id: 'r-1',
      keyLoanId: 'loan-9',
      receiptType: 'RETURN',
    } as never)
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-9',
      loanType: 'TENANT',
      contact: 'P001',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
      keyCardsArray: [],
    } as never)

    const { receiptData } = await prepareReceipt({ receiptId: 'r-1' })

    expect(receiptService.getById).toHaveBeenCalledWith('r-1')
    expect(receiptData.receiptType).toBe('RETURN')
    expect(receiptData.loanId).toBe('loan-9')
  })

  it('builds a maintenance loan receipt with scope + notes and no object options', async () => {
    vi.mocked(keyLoanService.get).mockResolvedValue({
      id: 'loan-m',
      loanType: 'MAINTENANCE',
      contact: 'F001',
      contactPerson: 'Anders',
      notes: 'Renovering A',
      keysArray: [makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' })],
      keyCardsArray: [],
    } as never)
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'F001', fullName: 'Acme Corp' })
    )
    vi.mocked(
      rentalObjectSearchService.getAddressesByRentalIds
    ).mockResolvedValue({ 'OBJ-1': 'Storgatan 5' })

    const { receiptData, objectOptions } = await prepareReceipt({
      loanId: 'loan-m',
    })

    expect(receiptData.loanType).toBe('MAINTENANCE')
    expect(receiptData.contacts[0].fullName).toBe('Acme Corp')
    expect(receiptData.contactPerson).toBe('Anders')
    expect(receiptData.comment).toBe('Renovering A')
    expect(receiptData.scopeByKeyId!['k1']).toBe('Storgatan 5')
    expect(objectOptions).toEqual([])
    expect(fetchLeasesByRentalPropertyId).not.toHaveBeenCalled()
  })

  it('throws when neither receiptId nor loanId resolves a loan', async () => {
    await expect(prepareReceipt({})).rejects.toThrow()
  })
})

describe('assembleReturnReceiptData (tenant)', () => {
  beforeEach(() => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001' })
    )
  })

  it('leaves missing/disposed/cards undefined when all keys returned and no cards', async () => {
    const result = await assembleReturnReceiptData({
      loan: { contact: 'P001', loanType: 'TENANT', contactPerson: null },
      loanKeys: [makeKey({ id: 'k1' })],
      selectedKeyIds: new Set(['k1']),
      leaseDisplayId: 'L-1',
    })

    expect(result.loanType).toBe('TENANT')
    expect(result.keys).toHaveLength(1)
    expect(result.missingKeys).toBeUndefined()
    expect(result.disposedKeys).toBeUndefined()
    expect(result.cards).toBeUndefined()
    expect(result.scopeByKeyId).toBeUndefined()
    expect(result.leaseDisplayId).toBe('L-1')
    expect(result.receiptType).toBe('RETURN')
  })

  it('populates missing, disposed, cards, comment on a full return', async () => {
    const result = await assembleReturnReceiptData({
      loan: { contact: 'P001', loanType: 'TENANT', contactPerson: null },
      loanKeys: [
        makeKey({ id: 'k1' }),
        makeKey({ id: 'k2' }),
        makeKey({ id: 'k3', disposed: true }),
      ],
      selectedKeyIds: new Set(['k1']),
      loanCards: [makeCard({ cardId: 'c1' }), makeCard({ cardId: 'c2' })],
      selectedCardIds: new Set(['c1']),
      comment: 'Test comment',
    })

    expect(result.keys.map((k) => k.id)).toEqual(['k1'])
    expect(result.missingKeys!.map((k) => k.id)).toEqual(['k2'])
    expect(result.disposedKeys!.map((k) => k.id)).toEqual(['k3'])
    expect(result.cards!.map((c) => c.cardId)).toEqual(['c1'])
    expect(result.missingCards!.map((c) => c.cardId)).toEqual(['c2'])
    expect(result.comment).toBe('Test comment')
    expect(result.remainingLoanKeys).toBeUndefined()
  })

  it('renders unchecked items as remaining (not missing) on a partial return', async () => {
    const result = await assembleReturnReceiptData({
      loan: { contact: 'P001', loanType: 'TENANT', contactPerson: null },
      loanKeys: [makeKey({ id: 'k1' }), makeKey({ id: 'k2' })],
      selectedKeyIds: new Set(['k1']),
      loanCards: [makeCard({ cardId: 'c1' }), makeCard({ cardId: 'c2' })],
      selectedCardIds: new Set(['c1']),
      partialReturn: true,
    })

    expect(result.remainingLoanKeys!.map((k) => k.id)).toEqual(['k2'])
    expect(result.remainingLoanCards!.map((c) => c.cardId)).toEqual(['c2'])
    expect(result.missingKeys).toBeUndefined()
    expect(result.missingCards).toBeUndefined()
  })

  it('names the loan borrower, not a passed-in lease tenant', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P999', fullName: 'Real Borrower' })
    )
    const result = await assembleReturnReceiptData({
      loan: { contact: 'P999', loanType: 'TENANT', contactPerson: null },
      loanKeys: [makeKey({ id: 'k1' })],
      selectedKeyIds: new Set(['k1']),
    })

    expect(result.contacts[0].fullName).toBe('Real Borrower')
  })
})

describe('assembleReturnReceiptData (maintenance)', () => {
  beforeEach(() => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'F001', fullName: 'Acme Corp' })
    )
    vi.mocked(rentalObjectSearchService.getAddressesByRentalIds)
      .mockReset()
      .mockResolvedValue({ 'OBJ-1': 'Storgatan 5' })
  })

  it('resolves company borrower + per-key scope, omits the Avtal block', async () => {
    const result = await assembleReturnReceiptData({
      loan: {
        contact: 'F001',
        loanType: 'MAINTENANCE',
        contactPerson: 'Anders',
      },
      loanKeys: [
        makeKey({ id: 'k1', rentalObjectCode: 'OBJ-1' }),
        makeKey({ id: 'k2', rentalObjectCode: 'OBJ-1' }),
      ],
      selectedKeyIds: new Set(['k1']),
      // Avtal fields are ignored for maintenance even if passed:
      leaseDisplayId: 'should-be-dropped',
      rentalPropertyId: 'should-be-dropped',
    })

    expect(result.loanType).toBe('MAINTENANCE')
    expect(result.contacts[0].fullName).toBe('Acme Corp')
    expect(result.contactPerson).toBe('Anders')
    expect(result.keys.map((k) => k.id)).toEqual(['k1'])
    expect(result.missingKeys!.map((k) => k.id)).toEqual(['k2'])
    expect(result.scopeByKeyId!['k1']).toBe('Storgatan 5')
    expect(result.leaseDisplayId).toBeUndefined()
    expect(result.rentalPropertyId).toBeUndefined()
  })
})
