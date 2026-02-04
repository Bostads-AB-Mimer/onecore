import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

// Mock database connection (like signatures.test.ts)
const mockTransaction: any = {
  transaction: jest.fn((callback: any) => callback(mockTransaction)),
}
jest.mock('../../adapters/db', () => ({
  db: mockTransaction,
}))

// Import after mocking external dependencies
import { routes } from '../../routes/receipts'
import * as factory from '../factories'
import * as receiptsAdapter from '../../adapters/receipts-adapter'

// Set up a Koa app with the receipts routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

/**
 * Tests for receipts endpoints
 * Phase 6C: Receipts - Audit trail for legal compliance
 */

describe('POST /receipts', () => {
  it('creates a receipt for a loan successfully', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000001'
    const loanReceipt = factory.receipt.build({
      id: validUuid,
      keyLoanId: validUuid,
      receiptType: 'LOAN',
      type: 'DIGITAL',
    })

    // Mock key loan exists
    jest.spyOn(receiptsAdapter, 'keyLoanExists').mockResolvedValueOnce(true)
    jest
      .spyOn(receiptsAdapter, 'createReceipt')
      .mockResolvedValueOnce(loanReceipt)

    const res = await request(app.callback()).post('/receipts').send({
      keyLoanId: validUuid,
      receiptType: 'LOAN',
      type: 'DIGITAL',
    })

    expect(receiptsAdapter.createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        keyLoanId: validUuid,
        receiptType: 'LOAN',
        type: 'DIGITAL',
      }),
      expect.anything()
    )
    expect(res.status).toBe(201)
    expect(res.body.content.receiptType).toBe('LOAN')
  })

  it('creates a receipt for a return successfully', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000002'
    const returnReceipt = factory.receipt.build({
      id: validUuid,
      keyLoanId: validUuid,
      receiptType: 'RETURN',
      type: 'PHYSICAL',
    })

    jest.spyOn(receiptsAdapter, 'keyLoanExists').mockResolvedValueOnce(true)
    jest
      .spyOn(receiptsAdapter, 'createReceipt')
      .mockResolvedValueOnce(returnReceipt)

    const res = await request(app.callback()).post('/receipts').send({
      keyLoanId: validUuid,
      receiptType: 'RETURN',
      type: 'PHYSICAL',
    })

    expect(res.status).toBe(201)
    expect(res.body.content.receiptType).toBe('RETURN')
    expect(res.body.content.type).toBe('PHYSICAL')
  })

  it('returns 404 when creating receipt for non-existent key loan', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000003'

    // Mock key loan does not exist
    jest.spyOn(receiptsAdapter, 'keyLoanExists').mockResolvedValueOnce(false)

    const res = await request(app.callback()).post('/receipts').send({
      keyLoanId: validUuid,
      receiptType: 'LOAN',
      type: 'DIGITAL',
    })

    expect(res.status).toBe(404)
    expect(res.body.reason).toContain('Key loan not found')
  })

  it('allows multiple receipts for the same key loan', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000004'
    // Business rule: multiple receipts allowed (e.g., LOAN + RETURN)
    const loanReceipt = factory.receipt.build({
      keyLoanId: validUuid,
      receiptType: 'LOAN',
    })
    const returnReceipt = factory.receipt.build({
      keyLoanId: validUuid,
      receiptType: 'RETURN',
    })

    jest.spyOn(receiptsAdapter, 'keyLoanExists').mockResolvedValue(true)

    // Create first receipt
    jest
      .spyOn(receiptsAdapter, 'createReceipt')
      .mockResolvedValueOnce(loanReceipt)

    const res1 = await request(app.callback()).post('/receipts').send({
      keyLoanId: validUuid,
      receiptType: 'LOAN',
      type: 'DIGITAL',
    })

    expect(res1.status).toBe(201)

    // Create second receipt for same loan
    jest
      .spyOn(receiptsAdapter, 'createReceipt')
      .mockResolvedValueOnce(returnReceipt)

    const res2 = await request(app.callback()).post('/receipts').send({
      keyLoanId: validUuid,
      receiptType: 'RETURN',
      type: 'DIGITAL',
    })

    expect(res2.status).toBe(201)
  })
})

describe('GET /receipts/:id', () => {
  it('retrieves a receipt by ID successfully', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000006'
    const mockReceipt = factory.receipt.build({
      id: validUuid,
      keyLoanId: validUuid,
      receiptType: 'LOAN',
    })

    jest
      .spyOn(receiptsAdapter, 'getReceiptById')
      .mockResolvedValueOnce(mockReceipt)

    const res = await request(app.callback()).get(`/receipts/${validUuid}`)

    expect(receiptsAdapter.getReceiptById).toHaveBeenCalledWith(
      validUuid,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content.id).toBe(validUuid)
  })
})

describe('GET /receipts/by-key-loan/:keyLoanId', () => {
  it('links receipts to key loan - retrieves all receipts for a loan', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000008'
    const receipts = [
      factory.receipt.build({
        id: '00000000-0000-0000-0000-000000000009',
        keyLoanId: validUuid,
        receiptType: 'LOAN',
      }),
      factory.receipt.build({
        id: '00000000-0000-0000-0000-000000000010',
        keyLoanId: validUuid,
        receiptType: 'RETURN',
      }),
    ]

    jest
      .spyOn(receiptsAdapter, 'getReceiptsByKeyLoanId')
      .mockResolvedValueOnce(receipts)

    const res = await request(app.callback()).get(
      `/receipts/by-key-loan/${validUuid}`
    )

    expect(receiptsAdapter.getReceiptsByKeyLoanId).toHaveBeenCalledWith(
      validUuid,
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
    expect(res.body.content[0].receiptType).toBe('LOAN')
    expect(res.body.content[1].receiptType).toBe('RETURN')
  })

  it('validates audit trail - receipts maintain chronological order', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000012'
    const now = Date.now()
    const receipts = [
      factory.receipt.build({
        keyLoanId: validUuid,
        receiptType: 'RETURN',
        createdAt: new Date(now), // Most recent first
      }),
      factory.receipt.build({
        keyLoanId: validUuid,
        receiptType: 'LOAN',
        createdAt: new Date(now - 86400000), // 1 day ago
      }),
    ]

    jest
      .spyOn(receiptsAdapter, 'getReceiptsByKeyLoanId')
      .mockResolvedValueOnce(receipts)

    const res = await request(app.callback()).get(
      `/receipts/by-key-loan/${validUuid}`
    )

    expect(res.status).toBe(200)
    expect(res.body.content[0].receiptType).toBe('RETURN')
    expect(res.body.content[1].receiptType).toBe('LOAN')
  })
})

/**
 * Note: PATCH /receipts/:id endpoint tests
 *
 * The PATCH endpoint uses parseRequestBody middleware which makes unit testing
 * more complex. The endpoint supports:
 * - Updating receiptFormat, receiptType, signedBy, signedAt
 * - Returns 404 when receipt not found
 * - Returns 400 for invalid UUID format
 * - Returns 500 for database errors
 *
 * Integration tests would be more appropriate for this endpoint.
 */

/**
 * Tests for DELETE /receipts/:id endpoint
 *
 * Testing receipt deletion:
 * - Successful deletion
 * - Receipt not found (404)
 * - Invalid UUID format (400)
 * - Database errors
 */
describe('DELETE /receipts/:id', () => {
  it('deletes receipt successfully and returns 204', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000024'
    const mockReceipt = factory.receipt.build({ id: validUuid })

    jest
      .spyOn(receiptsAdapter, 'getReceiptById')
      .mockResolvedValueOnce(mockReceipt)

    const deleteReceiptSpy = jest
      .spyOn(receiptsAdapter, 'deleteReceipt')
      .mockResolvedValueOnce(1) // 1 row deleted

    const res = await request(app.callback()).delete(`/receipts/${validUuid}`)

    expect(deleteReceiptSpy).toHaveBeenCalledWith(validUuid, expect.anything())
    expect(res.status).toBe(204) // No Content
  })

  it('returns 404 when receipt not found', async () => {
    const validUuid = '00000000-0000-0000-0000-000000000025'
    jest
      .spyOn(receiptsAdapter, 'getReceiptById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).delete(`/receipts/${validUuid}`)

    expect(res.status).toBe(404)
    expect(res.body.reason).toContain('Receipt not found')
  })

  it('validates invalid UUID format and returns 400', async () => {
    const res = await request(app.callback()).delete('/receipts/invalid-uuid')

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Invalid id')
  })
})
