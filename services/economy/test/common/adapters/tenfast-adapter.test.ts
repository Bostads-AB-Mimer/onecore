import axios from 'axios'
import assert from 'node:assert'
import {
  getTenantByContactCode,
  getInvoicesForTenant,
  getInvoiceByOcr,
  getInvoiceArticle,
  getActiveLeasesByRentalObjectCodes,
  recordPaymentForInvoice,
  getInvoicePdf,
  getAutogiroConsentByNationalRegistrationNumber,
  setGracePeriod,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { PaymentStatus } from '@onecore/types'
import {
  TenfastTenantByContactCodeResponseFactory,
  TenfastInvoicesByTenantIdResponseFactory,
  TenfastInvoicesByOcrResponseFactory,
  TenfastRentArticleFactory,
  TenfastInvoiceFactory,
  TenfastInvoiceRowFactory,
  TenfastLeaseFactory,
  TenfastAutogiroConsentFactory,
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
        statusCode: 404,
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
        leaseIds: expect.arrayContaining([expect.any(String)]),
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

    it('should return error when no invoice is found', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: [] },
      })

      const result = await getInvoiceByOcr('NONEXISTENT')

      expect(result).toEqual({
        ok: false,
        err: 'Invoice with ocr NONEXISTENT not found',
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

  describe(getActiveLeasesByRentalObjectCodes, () => {
    const periodStart = new Date('2026-01-01')
    const periodEnd = new Date('2026-01-31')

    const makeBatchResponse = (records: object[]) =>
      mockAxios.request.mockResolvedValue({ status: 200, data: records })

    it('enriches a rental object whose lease covers the full period', async () => {
      makeBatchResponse([
        {
          _id: 'obj-1',
          externalId: '306-008-01-0201',
          avtal: [
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/01',
              startDate: new Date('2025-01-01'),
              endDate: null,
              stage: 'active',
              hyresgaster: [],
              hyresobjekt: [],
            }),
          ],
        },
      ])

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-0201'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-0201')).toMatchObject({
        leaseId: '306-008-01-0201/01',
      })
    })

    it('returns null for a rental object whose lease only partially covers the period', async () => {
      makeBatchResponse([
        {
          _id: 'obj-1',
          externalId: '306-008-01-0201',
          avtal: [
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/01',
              startDate: new Date('2026-01-15'), // started mid-period
              endDate: null,
              stage: 'active',
              hyresgaster: [],
              hyresobjekt: [],
            }),
          ],
        },
      ])

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-0201'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-0201')).toBeNull()
    })

    it('returns null when lease ended before period end', async () => {
      makeBatchResponse([
        {
          _id: 'obj-1',
          externalId: '306-008-01-0201',
          avtal: [
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/01',
              startDate: new Date('2025-01-01'),
              endDate: new Date('2026-01-15'), // ended mid-period
              stage: 'active',
              hyresgaster: [],
              hyresobjekt: [],
            }),
          ],
        },
      ])

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-0201'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-0201')).toBeNull()
    })

    it('returns undefined for rental objects not found in Tenfast', async () => {
      makeBatchResponse([]) // Tenfast returns no records for the requested code

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-9999'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-9999')).toBeUndefined()
    })

    it('excludes draft and signingInProgress leases', async () => {
      makeBatchResponse([
        {
          _id: 'obj-1',
          externalId: '306-008-01-0201',
          avtal: [
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/01',
              startDate: new Date('2025-01-01'),
              endDate: null,
              stage: 'draft',
              hyresgaster: [],
              hyresobjekt: [],
            }),
          ],
        },
      ])

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-0201'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-0201')).toBeNull()
    })

    it('returns MultipleLeaseMatch when two leases both cover the full period', async () => {
      makeBatchResponse([
        {
          _id: 'obj-1',
          externalId: '306-008-01-0201',
          avtal: [
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/01',
              startDate: new Date('2025-01-01'),
              endDate: null,
              stage: 'active',
              hyresgaster: [],
              hyresobjekt: [],
            }),
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/02',
              startDate: new Date('2024-06-01'),
              endDate: null,
              stage: 'active',
              hyresgaster: [],
              hyresobjekt: [],
            }),
          ],
        },
      ])

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-0201'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-0201')).toEqual({
        leaseIds: expect.arrayContaining([
          '306-008-01-0201/01',
          '306-008-01-0201/02',
        ]),
      })
    })

    it('includes leaseEndDate when lease ended after the period', async () => {
      const leaseEndDate = new Date('2026-02-28')

      makeBatchResponse([
        {
          _id: 'obj-1',
          externalId: '306-008-01-0201',
          avtal: [
            TenfastLeaseFactory.build({
              externalId: '306-008-01-0201/01',
              startDate: new Date('2025-01-01'),
              endDate: leaseEndDate, // after period end — full coverage
              stage: 'active',
              hyresgaster: [],
              hyresobjekt: [],
            }),
          ],
        },
      ])

      const result = await getActiveLeasesByRentalObjectCodes({
        rentalObjectCodes: ['306-008-01-0201'],
        periodStart,
        periodEnd,
      })

      expect(result.get('306-008-01-0201')).toMatchObject({
        leaseId: '306-008-01-0201/01',
        leaseEndDate,
      })
    })
  })
})

describe(recordPaymentForInvoice, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const payment = {
    ocr: '55123456',
    amount: 1000,
    dateTime: new Date('2026-04-02T10:00:00Z'),
    method: 'bank',
  }

  it('returns not-found when OCR lookup returns no records', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [] },
    })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns unknown when OCR lookup returns non-200', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 500,
      statusText: 'Server Error',
    })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown when OCR lookup response fails schema parse', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { unexpected: true },
    })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('records the payment and returns ok', async () => {
    const invoice = TenfastInvoiceFactory.build()

    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [{ ...invoice, avtal: [] }] },
      })
      .mockResolvedValueOnce({
        status: 201,
        data: {},
      })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: true, data: null })
    expect(mockAxios.request).toHaveBeenCalledTimes(2)
    expect(mockAxios.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/v1/hyresvard/transactions'),
        method: 'POST',
        data: expect.objectContaining({
          type: 'hyra',
          amount: 1000,
          method: 'bank',
          hyra: invoice._id,
        }),
      })
    )
  })

  it('returns not-found when transaction POST returns 404', async () => {
    const invoice = TenfastInvoiceFactory.build()

    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [{ ...invoice, avtal: [] }] },
      })
      .mockResolvedValueOnce({
        status: 404,
        data: {},
      })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns unknown when transaction POST returns unexpected status', async () => {
    const invoice = TenfastInvoiceFactory.build()

    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [{ ...invoice, avtal: [] }] },
      })
      .mockResolvedValueOnce({
        status: 500,
        data: {},
      })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on thrown error', async () => {
    mockAxios.request.mockRejectedValueOnce(new Error('Network error'))

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(getInvoicePdf, () => {
  const ocr = '55123456'
  const tenfastId = 'invoice-1'
  const ocrLookupResponse = TenfastInvoicesByOcrResponseFactory.build({
    records: [
      { ...TenfastInvoiceFactory.build({ _id: tenfastId, ocrNumber: ocr }) },
    ],
  })

  it('returns pdf data and content-disposition on success', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 mock')
    mockAxios.request
      .mockResolvedValueOnce({ status: 200, data: ocrLookupResponse })
      .mockResolvedValueOnce({
        status: 200,
        data: pdfBuffer,
        headers: { 'content-disposition': 'attachment; filename=Hyresavi.pdf' },
      })

    const result = await getInvoicePdf(ocr)

    expect(result).toEqual({
      ok: true,
      data: {
        data: Buffer.from(pdfBuffer),
        contentDisposition: 'attachment; filename=Hyresavi.pdf',
      },
    })
  })

  it('returns not-found when OCR lookup returns no records', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [] },
    })

    const result = await getInvoicePdf(ocr)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns not-found when download-pdf returns 404', async () => {
    mockAxios.request
      .mockResolvedValueOnce({ status: 200, data: ocrLookupResponse })
      .mockResolvedValueOnce({ status: 404, data: {} })

    const result = await getInvoicePdf(ocr)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns unknown when OCR lookup fails with non-200', async () => {
    mockAxios.request.mockResolvedValueOnce({ status: 500, data: {} })

    const result = await getInvoicePdf(ocr)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on thrown error', async () => {
    mockAxios.request.mockRejectedValueOnce(new Error('Network error'))

    const result = await getInvoicePdf(ocr)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(getAutogiroConsentByNationalRegistrationNumber, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns consent when found', async () => {
    const consent = TenfastAutogiroConsentFactory.build({
      payerSSN: '199001011234',
    })
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [consent], prev: null, next: null, totalCount: 1 },
    })

    const result =
      await getAutogiroConsentByNationalRegistrationNumber('199001011234')

    expect(result).toEqual({ ok: true, data: consent })
  })

  it('returns null when no consent found', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [], prev: null, next: null, totalCount: 0 },
    })

    const result =
      await getAutogiroConsentByNationalRegistrationNumber('199001019999')

    expect(result).toEqual({ ok: true, data: null })
  })

  it('formats nationalRegistrationNumber without dash before sending', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [], prev: null, next: null, totalCount: 0 },
    })

    await getAutogiroConsentByNationalRegistrationNumber('199001011234')

    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          'filter[payerSSN]': '19900101-1234',
        }),
      })
    )
  })

  it('does not reformat nationalRegistrationNumber that already has dash', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [], prev: null, next: null, totalCount: 0 },
    })

    await getAutogiroConsentByNationalRegistrationNumber('19900101-1234')

    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          'filter[payerSSN]': '19900101-1234',
        }),
      })
    )
  })

  it('returns error on non-200 response', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 503,
      statusText: 'Service Unavailable',
    })

    const result =
      await getAutogiroConsentByNationalRegistrationNumber('199001011234')

    expect(result).toEqual({
      ok: false,
      err: 'Service Unavailable',
      statusCode: 503,
    })
  })

  it('returns schema-error on invalid response format', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { invalid: true },
    })

    const result =
      await getAutogiroConsentByNationalRegistrationNumber('199001011234')

    assert(!result.ok)
    expect(result.err).toBe('schema-error')
  })
})

describe(setGracePeriod, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const params = {
    invoiceOcr: '55123456',
    endDate: '2026-06-30',
    madeByEmail: 'admin@mimer.nu',
    reason: 'Betalningsplan överenskommen.',
  }

  const invoiceRecord = { _id: 'tenfast-invoice-id-123' }

  it('returns ok when grace period is set successfully', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [invoiceRecord] },
      })
      .mockResolvedValueOnce({ status: 200, data: {} })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: true, data: null })
  })

  it('calls grace-period endpoint with correct body', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [invoiceRecord] },
      })
      .mockResolvedValueOnce({ status: 200, data: {} })

    await setGracePeriod(params)

    expect(mockAxios.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: `/v1/hyresvard/hyror/${invoiceRecord._id}/grace-period`,
        method: 'POST',
        data: expect.objectContaining({
          endDate: params.endDate,
          madeByEmail: params.madeByEmail,
          reason: params.reason,
        }),
      })
    )
  })

  it('omits reason from body when not provided', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [invoiceRecord] },
      })
      .mockResolvedValueOnce({ status: 200, data: {} })

    const { reason: _reason, ...paramsWithoutReason } = params
    await setGracePeriod(paramsWithoutReason)

    expect(mockAxios.request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: `/v1/hyresvard/hyror/${invoiceRecord._id}/grace-period`,
        method: 'POST',
        data: {
          endDate: params.endDate,
          madeByEmail: params.madeByEmail,
        },
      })
    )
  })

  it('returns not-found when OCR lookup returns no records', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { records: [] },
    })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'not-found' })
    expect(mockAxios.request).toHaveBeenCalledTimes(1)
  })

  it('returns unknown when OCR lookup returns non-200', async () => {
    mockAxios.request.mockResolvedValueOnce({ status: 500, data: {} })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown when OCR lookup response fails schema parse', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { unexpected: true },
    })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns not-found when grace-period endpoint returns 404', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [invoiceRecord] },
      })
      .mockResolvedValueOnce({ status: 404, data: {} })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns unknown when grace-period endpoint returns unexpected status', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: { records: [invoiceRecord] },
      })
      .mockResolvedValueOnce({ status: 500, data: {} })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on thrown error', async () => {
    mockAxios.request.mockRejectedValueOnce(new Error('Network error'))

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
