import axios from 'axios'
import assert from 'node:assert'
import {
  getTenantByContactCode,
  getInvoicesForTenant,
  getInvoiceByOcr,
  getInvoiceArticle,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { PaymentStatus } from '@onecore/types'
import {
  TenfastTenantByContactCodeResponseFactory,
  TenfastInvoicesByTenantIdResponseFactory,
  TenfastInvoicesByOcrResponseFactory,
  TenfastRentArticleFactory,
  TenfastInvoiceFactory,
  TenfastInvoiceRowFactory,
} from '../../factories'

// Mock axios
jest.mock('axios')
const mockAxios = axios as jest.Mocked<typeof axios>

// Mock config
jest.mock('@src/common/config', () => ({
  tenfast: {
    baseUrl: 'https://test-api.tenfast.com',
    apiKey: 'test-api-key',
  },
}))

describe('Tenfast Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe(getTenantByContactCode, () => {
    it('should return tenant data when request is successful', async () => {
      const mockResponse = TenfastTenantByContactCodeResponseFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      })

      const result = await getTenantByContactCode('P999999')

      expect(result).toEqual({
        ok: true,
        data: mockResponse.records[0],
      })
    })

    it('should return null when no tenant is found', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: [] },
      })

      const result = await getTenantByContactCode('NONEXISTENT')

      expect(result).toEqual({
        ok: true,
        data: null,
      })
    })

    it('should return error when request fails with non-200 status', async () => {
      mockAxios.request.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
      })

      const result = await getTenantByContactCode('P999999')

      expect(result).toEqual({
        ok: false,
        err: 'Not Found',
      })
    })

    it('should handle invalid response format', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { invalidFormat: true },
      })

      const result = await getTenantByContactCode('P999999')

      assert(!result.ok)
      expect(result.err).toBe('schema-error')
    })
  })

  describe(getInvoicesForTenant, () => {
    it('should return transformed invoice data when request is successful', async () => {
      const mockInvoices = TenfastInvoicesByTenantIdResponseFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockInvoices,
      })

      const result = await getInvoicesForTenant('tenant-123')

      assert(result.ok)
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        amount: 1000,
        debitStatus: 0,
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-01-31'),
        invoiceDate: new Date('2024-01-15T10:00:00Z'),
        expirationDate: new Date('2024-02-15T10:00:00Z'),
        paidAmount: 0,
        remainingAmount: 1000,
        invoiceId: '55123456',
        leaseId: '',
        paymentStatus: PaymentStatus.Unpaid,
        reference: '55123456',
        source: 'next',
      })
      expect(result.data[0].invoiceRows).toHaveLength(1)
      expect(result.data[0].invoiceRows[0]).toMatchObject({
        amount: 1000,
        rentArticle: 'HYRAB',
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
        vat: 0,
        printGroup: 'Hyra bostad',
      })
    })

    it('should transform paid invoices correctly', async () => {
      const paidInvoice = [
        TenfastInvoiceFactory.build({
          amountPaid: 1000,
          hyror: [TenfastInvoiceRowFactory.build()],
        }),
      ]

      mockAxios.request.mockResolvedValue({
        status: 200,
        data: paidInvoice,
      })

      const result = await getInvoicesForTenant('tenant-123')

      assert(result.ok)
      expect(result.data[0].paymentStatus).toBe(PaymentStatus.Paid)
      expect(result.data[0].remainingAmount).toBe(0)
    })
  })

  describe(getInvoiceByOcr, () => {
    it('should return transformed invoice data when found', async () => {
      const mockResponse = TenfastInvoicesByOcrResponseFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      })

      const result = await getInvoiceByOcr('55123456')

      assert(result.ok)
      expect(result.data).toMatchObject({
        amount: 1000,
        paidAmount: 500,
        remainingAmount: 500,
        invoiceId: '55123456',
        paymentStatus: PaymentStatus.Unpaid,
      })
    })

    it('should return null when no invoice is found', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: [] },
      })

      const result = await getInvoiceByOcr('NONEXISTENT')

      expect(result).toEqual({
        ok: true,
        data: null,
      })
    })

    it('should return error when response format is invalid', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { invalid: true },
      })

      const result = await getInvoiceByOcr('55123456')

      assert(!result.ok)
      expect(result.err).toBe('schema-error')
    })
  })

  describe(getInvoiceArticle, () => {
    it('should return article data when request is successful', async () => {
      const mockArticle = TenfastRentArticleFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockArticle,
      })

      const result = await getInvoiceArticle('HYRAB')

      expect(result).toEqual({
        ok: true,
        data: mockArticle,
      })
    })

    it('should return error when article is not found', async () => {
      mockAxios.request.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
      })

      const result = await getInvoiceArticle('NONEXISTENT')

      expect(result).toEqual({
        ok: false,
        err: 'Not Found',
      })
    })

    it('should handle invalid response format', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { invalidFormat: true },
      })

      const result = await getInvoiceArticle('HYRAB')

      assert(!result.ok)
      expect(result.err).toBe('schema-error')
    })
  })
})
