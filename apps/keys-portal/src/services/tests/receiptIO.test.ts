import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  createPendingReceipt,
  attachPdf,
  createReceiptWithPdf,
} from '../loans/receiptIO'
import { receiptService } from '../api/receiptService'

vi.mock('../api/receiptService', () => ({
  receiptService: {
    create: vi.fn(),
    uploadFile: vi.fn(),
  },
}))

beforeEach(() => {
  vi.mocked(receiptService.create).mockReset()
  vi.mocked(receiptService.uploadFile).mockReset()
})

describe('createPendingReceipt', () => {
  it('creates a PHYSICAL receipt row of the given type for the loan', async () => {
    vi.mocked(receiptService.create).mockResolvedValue({ id: 'r1' } as never)

    const receipt = await createPendingReceipt('loan-1', 'LOAN')

    expect(receiptService.create).toHaveBeenCalledWith({
      keyLoanId: 'loan-1',
      receiptType: 'LOAN',
      type: 'PHYSICAL',
    })
    expect(receipt.id).toBe('r1')
  })
})

describe('attachPdf', () => {
  it('uploads a PDF File named with the prefix and returns the fileId', async () => {
    vi.mocked(receiptService.uploadFile).mockResolvedValue({
      fileId: 'f1',
    } as never)

    const blob = new Blob(['x'], { type: 'application/pdf' })
    const fileId = await attachPdf('r1', blob, 'return')

    expect(fileId).toBe('f1')
    expect(receiptService.uploadFile).toHaveBeenCalledTimes(1)
    const [receiptId, file] = vi.mocked(receiptService.uploadFile).mock.calls[0]
    expect(receiptId).toBe('r1')
    expect(file).toBeInstanceOf(File)
    expect((file as File).name).toBe('return_r1.pdf')
    expect((file as File).type).toBe('application/pdf')
  })
})

describe('createReceiptWithPdf', () => {
  it('creates the row, attaches the pdf, and returns the receipt with its fileId', async () => {
    const calls: string[] = []
    vi.mocked(receiptService.create).mockImplementation(async () => {
      calls.push('create')
      return { id: 'r9' } as never
    })
    vi.mocked(receiptService.uploadFile).mockImplementation(async () => {
      calls.push('upload')
      return { fileId: 'f9' } as never
    })

    const blob = new Blob(['x'], { type: 'application/pdf' })
    const receipt = await createReceiptWithPdf('loan-9', 'LOAN', blob, 'loan')

    expect(calls).toEqual(['create', 'upload']) // row before file
    expect(receipt.id).toBe('r9')
    expect(receipt.fileId).toBe('f9')
  })
})
