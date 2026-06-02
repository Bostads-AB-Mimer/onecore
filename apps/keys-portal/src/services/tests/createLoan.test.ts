import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createPendingLoan } from '../loans/createLoan'
import { keyLoanService } from '../api/keyLoanService'
import { createPendingReceipt } from '../loans/receiptIO'

vi.mock('../api/keyLoanService', () => ({
  keyLoanService: { create: vi.fn() },
}))
vi.mock('../loans/receiptIO', () => ({
  createPendingReceipt: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(keyLoanService.create).mockReset()
  vi.mocked(createPendingReceipt).mockReset()
  vi.mocked(keyLoanService.create).mockResolvedValue({ id: 'loan-1' } as never)
  vi.mocked(createPendingReceipt).mockResolvedValue({ id: 'r-1' } as never)
})

describe('createPendingLoan', () => {
  it('rejects an empty selection without calling the API', async () => {
    const result = await createPendingLoan({
      loanType: 'TENANT',
      contact: 'P001',
    })

    expect(result.success).toBe(false)
    expect(keyLoanService.create).not.toHaveBeenCalled()
  })

  it('creates a tenant loan + LOAN receipt and returns both ids', async () => {
    const result = await createPendingLoan({
      loanType: 'TENANT',
      keyIds: ['k1'],
      cardIds: ['c1'],
      contact: 'P001',
      contact2: 'P002',
    })

    expect(keyLoanService.create).toHaveBeenCalledWith({
      loanType: 'TENANT',
      contact: 'P001',
      contact2: 'P002',
      keys: ['k1'],
      keyCards: ['c1'],
    })
    expect(createPendingReceipt).toHaveBeenCalledWith('loan-1', 'LOAN')
    expect(result.success).toBe(true)
    expect(result.loanId).toBe('loan-1')
    expect(result.receiptId).toBe('r-1')
  })

  it('sends a maintenance description as notes (not a dropped "description" field)', async () => {
    await createPendingLoan({
      loanType: 'MAINTENANCE',
      keyIds: ['k1'],
      contact: 'F001',
      contactPerson: 'Anders',
      notes: 'Renovering A',
    })

    const payload = vi.mocked(keyLoanService.create).mock.calls[0][0]
    expect(payload.notes).toBe('Renovering A')
    expect(payload.contactPerson).toBe('Anders')
    expect('description' in payload).toBe(false)
  })

  it('still succeeds (loan created) when receipt creation fails', async () => {
    vi.mocked(createPendingReceipt).mockRejectedValue(new Error('minio down'))

    const result = await createPendingLoan({
      loanType: 'TENANT',
      keyIds: ['k1'],
      contact: 'P001',
    })

    expect(result.success).toBe(true)
    expect(result.loanId).toBe('loan-1')
    expect(result.receiptId).toBeUndefined()
  })

  it('maps a 409 conflict to a friendly already-loaned message', async () => {
    vi.mocked(keyLoanService.create).mockRejectedValue({ status: 409 })

    const result = await createPendingLoan({
      loanType: 'TENANT',
      keyIds: ['k1'],
      contact: 'P001',
    })

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/redan utlånade/i)
  })
})
