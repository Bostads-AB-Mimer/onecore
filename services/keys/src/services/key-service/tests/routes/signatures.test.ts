import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

// Mock logger before importing routes
jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock Config module before importing routes
jest.mock('../../../../common/config', () => ({
  __esModule: true,
  default: {
    port: 5090,
    keysDatabase: {},
    simplesign: {
      apiUrl: 'https://test-simplesign.com',
      accessToken: 'test-token',
      webhookUrl: 'https://test.com/webhook',
      webhookSecret: 'test-secret',
    },
    simpleSign: {
      apiUrl: 'https://test-simplesign.com',
      accessToken: 'test-token',
      webhookUrl: 'https://test.com/webhook',
      webhookSecret: 'test-secret',
    },
  },
}))

// Mock database to handle transactions
const mockTransaction: any = {
  transaction: jest.fn((callback: any) => callback(mockTransaction)),
}
jest.mock('../../adapters/db', () => ({
  db: mockTransaction,
}))

jest.mock('../../adapters/simplesign-adapter', () => ({
  sendPdfForSignature: jest.fn(),
  downloadSignedPdf: jest.fn(),
}))

// Mock signature webhook service
jest.mock('../../signature-webhook-service', () => ({
  processSignatureWebhook: jest.fn(),
}))

// Import after mocking
import { routes } from '../../routes/signatures'
import * as signatureWebhookService from '../../signature-webhook-service'
import * as factory from '../factories'
import * as signaturesAdapter from '../../adapters/signatures-adapter'
import * as receiptsAdapter from '../../adapters/receipts-adapter'
import * as simpleSignApi from '../../adapters/simplesign-adapter'
import Config from '../../../../common/config'

// Set up a Koa app with the signatures routes for testing
const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Reset all mocks before each test
beforeEach(jest.clearAllMocks)

// Test data constants - use valid formats to pass Zod validation
const VALID_UUID = '00000000-0000-0000-0000-000000000123'
const VALID_PDF_BASE64 = Buffer.from('%PDF-1.4\ntest content').toString(
  'base64'
)

/**
 * Tests for POST /signatures/send endpoint
 *
 * Testing send document for signature via SimpleSign:
 * - Successful signature request
 * - Resource not found (receipt)
 * - SimpleSign API errors
 * - Database errors
 */
describe('POST /signatures/send', () => {
  it('sends a signature request successfully and responds with 201', async () => {
    const mockReceipt = factory.receipt.build({
      id: VALID_UUID,
    })

    const mockSimpleSignResponse = {
      id: 12345,
      status: 'sent',
    }

    const mockSignature = factory.signature.build({
      resourceType: 'receipt',
      resourceId: VALID_UUID,
      simpleSignDocumentId: 12345,
      recipientEmail: 'test@example.com',
      status: 'sent',
    })

    // Mock the receipt lookup
    jest
      .spyOn(receiptsAdapter, 'getReceiptById')
      .mockResolvedValueOnce(mockReceipt)

    // Mock SimpleSign API call using require (like receipts.test.ts does)
    const simpleSignModule = require('../../adapters/simplesign-adapter')
    simpleSignModule.sendPdfForSignature.mockResolvedValueOnce(
      mockSimpleSignResponse
    )

    // Mock signature creation
    const createSignatureSpy = jest
      .spyOn(signaturesAdapter, 'createSignature')
      .mockResolvedValueOnce(mockSignature)

    const res = await request(app.callback()).post('/signatures/send').send({
      resourceType: 'receipt',
      resourceId: VALID_UUID,
      pdfBase64: VALID_PDF_BASE64,
      recipientEmail: 'test@example.com',
      recipientName: 'Test Person',
    })

    expect(receiptsAdapter.getReceiptById).toHaveBeenCalledWith(
      VALID_UUID,
      expect.anything()
    )
    expect(simpleSignModule.sendPdfForSignature).toHaveBeenCalledWith({
      pdfBase64: VALID_PDF_BASE64,
      recipientEmail: 'test@example.com',
      recipientName: 'Test Person',
    })
    expect(createSignatureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'receipt',
        resourceId: VALID_UUID,
        simpleSignDocumentId: 12345,
        status: 'sent',
      }),
      expect.anything()
    )
    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      resourceId: VALID_UUID,
      status: 'sent',
    })
  })

  it('responds with 404 when receipt not found', async () => {
    jest
      .spyOn(receiptsAdapter, 'getReceiptById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).post('/signatures/send').send({
      resourceType: 'receipt',
      resourceId: '00000000-0000-0000-0000-000000000999', // Valid UUID
      pdfBase64: VALID_PDF_BASE64,
      recipientEmail: 'test@example.com',
    })

    expect(res.status).toBe(404)
    expect(res.body.reason).toContain('Receipt not found')
    expect(simpleSignApi.sendPdfForSignature).not.toHaveBeenCalled()
  })

  it('validates missing required field (pdfBase64) and returns 400', async () => {
    const res = await request(app.callback()).post('/signatures/send').send({
      resourceType: 'receipt',
      resourceId: 'receipt-123',
      // pdfBase64 is missing
      recipientEmail: 'test@example.com',
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
  })

  it('validates missing required field (recipientEmail) and returns 400', async () => {
    const res = await request(app.callback()).post('/signatures/send').send({
      resourceType: 'receipt',
      resourceId: 'receipt-123',
      pdfBase64: 'base64encodedpdf',
      // recipientEmail is missing
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('status', 'error')
  })

  it('handles SimpleSign API errors and returns 500', async () => {
    const mockReceipt = factory.receipt.build({ id: VALID_UUID })

    jest
      .spyOn(receiptsAdapter, 'getReceiptById')
      .mockResolvedValueOnce(mockReceipt)

    const simpleSignModule = require('../../adapters/simplesign-adapter')
    simpleSignModule.sendPdfForSignature.mockRejectedValueOnce(
      new Error('SimpleSign API unavailable')
    )

    const res = await request(app.callback()).post('/signatures/send').send({
      resourceType: 'receipt',
      resourceId: VALID_UUID,
      pdfBase64: VALID_PDF_BASE64,
      recipientEmail: 'test@example.com',
    })

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('Failed to send signature request')
  })
})

/**
 * Tests for GET /signatures/:id endpoint
 *
 * Testing get signature by ID:
 * - Successful retrieval
 * - Not found (404)
 * - Invalid UUID format (400)
 * - Database errors
 */
describe('GET /signatures/:id', () => {
  it('responds with 200 and signature data when found', async () => {
    const mockSignature = factory.signature.build({
      id: '00000000-0000-0000-0000-000000000123',
      status: 'sent',
    })

    const getByIdSpy = jest
      .spyOn(signaturesAdapter, 'getSignatureById')
      .mockResolvedValueOnce(mockSignature)

    const res = await request(app.callback()).get(
      '/signatures/00000000-0000-0000-0000-000000000123'
    )

    expect(getByIdSpy).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000123',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: '00000000-0000-0000-0000-000000000123',
      status: 'sent',
    })
  })

  it('responds with 400 for invalid UUID format', async () => {
    const res = await request(app.callback()).get('/signatures/invalid-uuid')

    expect(res.status).toBe(400)
    expect(res.body.reason).toContain('Invalid signature id')
    expect(signaturesAdapter.getSignatureById).not.toHaveBeenCalled()
  })
})

/**
 * Tests for GET /signatures/resource/:resourceType/:resourceId endpoint
 *
 * Testing get signatures for a resource:
 * - Successful retrieval with results
 * - Empty results
 * - Database errors
 */
describe('GET /signatures/resource/:resourceType/:resourceId', () => {
  it('returns all signatures for a resource', async () => {
    const mockSignatures = factory.signature.buildList(3, {
      resourceType: 'receipt',
      resourceId: 'receipt-123',
    })

    const getByResourceSpy = jest
      .spyOn(signaturesAdapter, 'getSignaturesByResourceId')
      .mockResolvedValueOnce(mockSignatures)

    const res = await request(app.callback()).get(
      '/signatures/resource/receipt/receipt-123'
    )

    expect(getByResourceSpy).toHaveBeenCalledWith(
      'receipt',
      'receipt-123',
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content[0]).toHaveProperty('resourceType', 'receipt')
  })
})

/**
 * Tests for POST /webhooks/simplesign endpoint
 *
 * Testing SimpleSign webhook processing:
 * - Successful webhook processing for 'sent' status
 * - Successful webhook processing for 'signed' status with file upload
 * - Webhook secret validation
 * - Signature not found
 * - Race condition handling (file already uploaded)
 * - Database errors
 *
 * NOTE: Webhook tests use database transactions. We mock db.transaction() to execute
 * the callback immediately, allowing all adapter mocks to work correctly.
 */
describe('POST /webhooks/simplesign', () => {
  beforeEach(() => {
    // Config is already mocked with webhook secret = 'test-secret'
  })

  it('processes webhook for status update (sent) successfully', async () => {
    // Mock service to return success without fileId
    const processWebhookSpy = jest
      .spyOn(signatureWebhookService, 'processSignatureWebhook')
      .mockResolvedValueOnce({ ok: true, data: {} })

    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .set('webhookSecret', 'test-secret')
      .send({
        id: 12345,
        status: 'sent',
        status_updated_at: '2025-01-15T10:00:00Z',
      })

    expect(processWebhookSpy).toHaveBeenCalledWith(
      {
        documentId: 12345,
        status: 'sent',
        statusUpdatedAt: '2025-01-15T10:00:00Z',
      },
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Webhook processed successfully')
  })

  // TODO: Re-enable when file upload via file-storage service is implemented
  it.skip('processes webhook for signed status and uploads file', async () => {
    // Mock service to return success with fileId
    const processWebhookSpy = jest
      .spyOn(signatureWebhookService, 'processSignatureWebhook')
      .mockResolvedValueOnce({
        ok: true,
        data: { fileId: 'file-id-123' },
      })

    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .set('webhookSecret', 'test-secret')
      .send({
        id: 12345,
        status: 'signed',
        status_updated_at: '2025-01-15T12:00:00Z',
      })

    expect(processWebhookSpy).toHaveBeenCalledWith(
      {
        documentId: 12345,
        status: 'signed',
        statusUpdatedAt: '2025-01-15T12:00:00Z',
      },
      expect.anything()
    )
    expect(res.status).toBe(200)
    expect(res.body.fileId).toBe('file-id-123')
  })

  it('rejects webhook with invalid secret and returns 401', async () => {
    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .set('webhookSecret', 'wrong-secret')
      .send({
        id: 12345,
        status: 'signed',
        status_updated_at: '2025-01-15T10:00:00Z',
      })

    expect(res.status).toBe(401)
    expect(res.body.reason).toContain('Unauthorized')
    // Service should not be called when auth fails
    expect(
      signatureWebhookService.processSignatureWebhook
    ).not.toHaveBeenCalled()
  })

  it('rejects webhook with missing secret and returns 401', async () => {
    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .send({
        id: 12345,
        status: 'signed',
        status_updated_at: '2025-01-15T10:00:00Z',
      })

    expect(res.status).toBe(401)
    expect(res.body.reason).toContain('Unauthorized')
  })

  it('responds with 404 when signature not found for document ID', async () => {
    // Mock service to return signature-not-found error
    jest
      .spyOn(signatureWebhookService, 'processSignatureWebhook')
      .mockResolvedValueOnce({ ok: false, err: 'signature-not-found' })

    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .set('webhookSecret', 'test-secret')
      .send({
        id: 99999,
        status: 'signed',
        status_updated_at: '2025-01-15T10:00:00Z',
      })

    expect(res.status).toBe(404)
    expect(res.body.reason).toContain('Signature not found')
  })

  it('handles race condition when receipt already has file (skips upload)', async () => {
    // Mock service to return success with existing fileId (race condition handled)
    jest
      .spyOn(signatureWebhookService, 'processSignatureWebhook')
      .mockResolvedValueOnce({ ok: true, data: { fileId: 'existing-file-id' } })

    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .set('webhookSecret', 'test-secret')
      .send({
        id: 12345,
        status: 'signed',
        status_updated_at: '2025-01-15T12:00:00Z',
      })

    expect(res.status).toBe(200)
    expect(res.body.fileId).toBe('existing-file-id')
  })

  it('handles SimpleSign download errors and returns 500', async () => {
    // Mock service to return download-pdf error
    jest
      .spyOn(signatureWebhookService, 'processSignatureWebhook')
      .mockResolvedValueOnce({ ok: false, err: 'download-pdf' })

    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .set('webhookSecret', 'test-secret')
      .send({
        id: 12345,
        status: 'signed',
        status_updated_at: '2025-01-15T12:00:00Z',
      })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Internal server error')
  })

  it('processes webhook without webhook secret when not configured', async () => {
    // Disable webhook secret validation
    ;(Config.simpleSign.webhookSecret as any) = undefined

    // Mock service to return success
    jest
      .spyOn(signatureWebhookService, 'processSignatureWebhook')
      .mockResolvedValueOnce({ ok: true, data: {} })

    const res = await request(app.callback())
      .post('/webhooks/simplesign')
      .send({
        id: 12345,
        status: 'sent',
        status_updated_at: '2025-01-15T10:00:00Z',
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Webhook processed successfully')
  })
})
