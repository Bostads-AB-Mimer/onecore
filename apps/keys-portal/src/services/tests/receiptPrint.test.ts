import { describe, it, expect, vi, beforeEach } from 'vitest'

import { generateReturnReceiptBlob } from '@/lib/pdf-receipts'

import { buildReturnReceiptBlob } from '../loans/receiptPrint'
import { fetchContactByContactCode } from '../api/contactService'
import { makeKey, makeContact } from './fixtures'

vi.mock('@/lib/pdf-receipts', () => ({
  generateLoanReceiptBlob: vi.fn(),
  generateReturnReceiptBlob: vi.fn(),
}))
// Mocked only to keep their base-api import (which touches `window`) out of node.
vi.mock('../api/keyLoanService', () => ({ keyLoanService: {} }))
vi.mock('../api/receiptService', () => ({ receiptService: {} }))
vi.mock('../api/leaseSearchService', () => ({
  fetchLeasesByRentalPropertyId: vi.fn(),
}))
vi.mock('../api/contactService', () => ({
  fetchContactByContactCode: vi.fn(),
}))
vi.mock('../api/rentalObjectSearchService', () => ({
  rentalObjectSearchService: {
    getAddressesByRentalIds: vi.fn().mockResolvedValue({}),
    getAddressByRentalId: vi.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => {
  vi.mocked(fetchContactByContactCode).mockReset()
  vi.mocked(generateReturnReceiptBlob).mockReset()
})

describe('buildReturnReceiptBlob', () => {
  it('assembles then renders, passing the loan-derived borrower to the PDF', async () => {
    vi.mocked(fetchContactByContactCode).mockResolvedValue(
      makeContact({ contactCode: 'P001', fullName: 'Anna A' })
    )
    vi.mocked(generateReturnReceiptBlob).mockResolvedValue({
      blob: new Blob(),
      fileName: 'return.pdf',
    })

    const result = await buildReturnReceiptBlob({
      loan: { contact: 'P001', loanType: 'TENANT', contactPerson: null },
      loanKeys: [makeKey({ id: 'k1' })],
      selectedKeyIds: new Set(['k1']),
    })

    expect(generateReturnReceiptBlob).toHaveBeenCalledTimes(1)
    const rendered = vi.mocked(generateReturnReceiptBlob).mock.calls[0][0]
    expect(rendered.receiptType).toBe('RETURN')
    expect(rendered.contacts[0].fullName).toBe('Anna A')
    expect(result.fileName).toBe('return.pdf')
  })
})
