import { describe, it, expect, vi, beforeEach } from 'vitest'

import { mergePdfBlobs } from '@/lib/pdf-merge'

import { returnLoan, partialReturnLoan } from '../loans/returnFlow'
import { keyLoanService } from '../api/keyLoanService'
import { receiptService } from '../api/receiptService'
import { createReceiptWithPdf } from '../loans/receiptIO'
import { buildReturnReceiptBlob } from '../loans/receiptPrint'
import {
  resolveObjectOptions,
  pickAutoContract,
} from '../loans/receiptResolution'
import { makeKey, makeLoan } from './fixtures'

vi.mock('../api/keyLoanService', () => ({
  keyLoanService: { update: vi.fn(), create: vi.fn() },
}))
vi.mock('../api/receiptService', () => ({
  receiptService: { getByKeyLoan: vi.fn(), getDownloadUrl: vi.fn() },
}))
vi.mock('../loans/receiptIO', () => ({ createReceiptWithPdf: vi.fn() }))
vi.mock('../loans/receiptPrint', () => ({ buildReturnReceiptBlob: vi.fn() }))
vi.mock('../loans/receiptResolution', () => ({
  resolveObjectOptions: vi.fn(),
  pickAutoContract: vi.fn(),
}))
vi.mock('@/lib/pdf-merge', () => ({ mergePdfBlobs: vi.fn() }))

const RETURN_BLOB = new Blob(['r'])

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(buildReturnReceiptBlob).mockResolvedValue({
    blob: RETURN_BLOB,
    fileName: 'return.pdf',
  })
  vi.mocked(createReceiptWithPdf).mockResolvedValue({ id: 'r-new' } as never)
  vi.mocked(keyLoanService.create).mockResolvedValue({
    id: 'loan-new',
  } as never)
  vi.mocked(resolveObjectOptions).mockResolvedValue([])
  vi.mocked(pickAutoContract).mockReturnValue({ address: null })
  vi.mocked(receiptService.getByKeyLoan).mockResolvedValue([])
})

describe('returnLoan', () => {
  it('stores the return receipt, then closes the loan with the availability date', async () => {
    const order: string[] = []
    vi.mocked(createReceiptWithPdf).mockImplementation(async () => {
      order.push('receipt')
      return { id: 'r-new' } as never
    })
    vi.mocked(keyLoanService.update).mockImplementation(async () => {
      order.push('close')
      return {} as never
    })
    const loan = makeLoan({ id: 'L1', keysArray: [makeKey({ id: 'k1' })] })

    const result = await returnLoan(
      loan,
      { selectedKeyIds: new Set(['k1']), selectedCardIds: new Set() },
      { availableToNextTenantFrom: '2025-06-01T00:00:00Z' }
    )

    expect(result.success).toBe(true)
    expect(order).toEqual(['receipt', 'close']) // receipt before close
    expect(createReceiptWithPdf).toHaveBeenCalledWith(
      'L1',
      'RETURN',
      RETURN_BLOB,
      'return'
    )
    expect(keyLoanService.update).toHaveBeenCalledWith('L1', {
      returnedAt: expect.any(String),
      availableToNextTenantFrom: '2025-06-01T00:00:00Z',
    })
  })

  it('auto-picks the Avtal for tenant returns but not maintenance', async () => {
    await returnLoan(
      makeLoan({
        id: 'L1',
        loanType: 'TENANT',
        keysArray: [makeKey({ id: 'k1' })],
      }),
      { selectedKeyIds: new Set(['k1']), selectedCardIds: new Set() },
      {}
    )
    expect(resolveObjectOptions).toHaveBeenCalledTimes(1)

    vi.mocked(resolveObjectOptions).mockClear()
    await returnLoan(
      makeLoan({
        id: 'L2',
        loanType: 'MAINTENANCE',
        keysArray: [makeKey({ id: 'k1' })],
      }),
      { selectedKeyIds: new Set(['k1']), selectedCardIds: new Set() },
      {}
    )
    expect(resolveObjectOptions).not.toHaveBeenCalled()
  })

  it('does not close the loan when the receipt cannot be produced', async () => {
    vi.mocked(buildReturnReceiptBlob).mockRejectedValue(new Error('no contact'))
    const result = await returnLoan(
      makeLoan({ id: 'L1', keysArray: [makeKey({ id: 'k1' })] }),
      { selectedKeyIds: new Set(['k1']), selectedCardIds: new Set() },
      {}
    )

    expect(result.success).toBe(false)
    expect(keyLoanService.update).not.toHaveBeenCalled()
  })
})

describe('partialReturnLoan', () => {
  const loan = makeLoan({
    id: 'OLD',
    loanType: 'TENANT',
    contact: 'P001',
    keysArray: [
      makeKey({ id: 'k1' }), // selected → returned
      makeKey({ id: 'k2' }), // unselected → continues
      makeKey({ id: 'k3', disposed: true }), // disposed → stays on old loan
    ],
  })
  const selection = {
    selectedKeyIds: new Set(['k1']),
    selectedCardIds: new Set<string>(),
  }

  it('closes the old loan, continues unselected non-disposed items, never carries disposed', async () => {
    const result = await partialReturnLoan(loan, selection, {})

    expect(result.success).toBe(true)
    expect(keyLoanService.update).toHaveBeenCalledWith('OLD', {
      returnedAt: expect.any(String),
      availableToNextTenantFrom: null,
    })
    const createArg = vi.mocked(keyLoanService.create).mock.calls[0][0]
    expect(createArg.keys).toEqual(['k2']) // k1 returned, k3 disposed → only k2
    expect(result.newLoanId).toBe('loan-new')
  })

  it('fails when nothing is left to continue', async () => {
    const result = await partialReturnLoan(
      makeLoan({ id: 'OLD', keysArray: [makeKey({ id: 'k1' })] }),
      { selectedKeyIds: new Set(['k1']), selectedCardIds: new Set() },
      {}
    )
    expect(result.success).toBe(false)
    expect(keyLoanService.update).not.toHaveBeenCalled()
  })

  it('merges the original loan receipt with the return PDF for the continuation loan', async () => {
    vi.mocked(receiptService.getByKeyLoan).mockResolvedValue([
      { id: 'old-loan-receipt', receiptType: 'LOAN', fileId: 'f1' },
    ] as never)
    vi.mocked(receiptService.getDownloadUrl).mockResolvedValue({
      url: 'http://x/old.pdf',
    } as never)
    const ORIGINAL = new Blob(['orig'])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => ORIGINAL })
    )
    const MERGED = new Blob(['merged'])
    vi.mocked(mergePdfBlobs).mockResolvedValue(MERGED)

    const result = await partialReturnLoan(loan, selection, {})

    expect(mergePdfBlobs).toHaveBeenCalledWith([ORIGINAL, RETURN_BLOB])
    expect(createReceiptWithPdf).toHaveBeenCalledWith(
      'loan-new',
      'LOAN',
      MERGED,
      'loan'
    )
    expect(result.fellBackToReturnOnly).toBeUndefined()
  })

  it('falls back to the return PDF alone when the old loan has no loan receipt', async () => {
    const result = await partialReturnLoan(loan, selection, {})

    expect(mergePdfBlobs).not.toHaveBeenCalled()
    expect(createReceiptWithPdf).toHaveBeenCalledWith(
      'loan-new',
      'LOAN',
      RETURN_BLOB,
      'loan'
    )
    expect(result.fellBackToReturnOnly).toBe(true)
  })
})
