import axios from 'axios'
import { logger } from '@onecore/utilities'
import assert from 'node:assert'
import {
  getTenantByContactCode,
  getRentalProperty,
  getLease,
  getInvoicesForTenant,
  getInvoicesByContactCode,
  getInvoiceByOcr,
  getInvoiceArticle,
  getActiveLeasesByRentalObjectCodes,
  recordPaymentForInvoice,
  getInvoicePdf,
  getAutogiroConsentByNationalRegistrationNumber,
  setGracePeriod,
  listNewOutboundExports,
  getRentalLosses,
  getLeasesByTenantId,
  markInvoicesAsExported,
  getInvoicesNotExported,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { MimerCompany } from '@src/common/types/typesv2'
import { LeaseType, PaymentStatus } from '@onecore/types'
import {
  TenfastTenantFactory,
  TenfastRentalPropertyFactory,
  TenfastLeaseFactory,
  TenfastInvoicesByTenantIdResponseFactory,
  TenfastInvoiceByOcrResponseFactory,
  TenfastRentArticleFactory,
  TenfastInvoiceFactory,
  TenfastInvoiceRowFactory,
  TenfastAutogiroConsentFactory,
  TenfastOutboundExportFactory,
  invoice as InvoiceFactory,
} from '../../factories'

// Mock axios
jest.mock('axios')
const mockAxios = axios as jest.Mocked<typeof axios>

// Mock config
jest.mock('@src/common/config', () => ({
  tenfast: {
    baseUrl: 'https://test-api.tenfast.com',
    apiKey: 'test-api-key',
    companyId: 'test-hyresvard-id',
  },
}))

describe('Tenfast Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe(getTenantByContactCode, () => {
    it('should return tenant data when request is successful', async () => {
      const mockTenant = TenfastTenantFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockTenant,
      })

      const result = await getTenantByContactCode('P999999')

      expect(result).toEqual({
        ok: true,
        data: mockTenant,
      })
    })

    it('should return null when no tenant is found (404)', async () => {
      mockAxios.request.mockResolvedValue({
        status: 404,
        data: { error: 'Not found' },
      })

      const result = await getTenantByContactCode('NONEXISTENT')

      expect(result).toEqual({
        ok: true,
        data: null,
      })
    })

    it('lets a 404 through instead of throwing, so a contact missing in Tenfast gives null', async () => {
      // Arrange
      mockAxios.request.mockResolvedValue({ status: 404, data: 'Not Found' })

      // Act
      await getTenantByContactCode('P135129')

      // Assert
      const [config] = mockAxios.request.mock.calls[0]
      expect(config.validateStatus?.(404)).toBe(true)
      expect(config.validateStatus?.(200)).toBe(true)
      expect(config.validateStatus?.(500)).toBe(false)
    })

    it('logs the status and message, not the raw request error, when the request fails', async () => {
      // Arrange
      const requestError = Object.assign(new Error('Request failed'), {
        response: { status: 502 },
        config: { headers: { 'api-token': 'secret-token' } },
      })
      mockAxios.request.mockRejectedValue(requestError)
      mockAxios.isAxiosError.mockReturnValueOnce(true)

      // Act
      const result = await getTenantByContactCode('P999999')

      // Assert
      assert(!result.ok)
      expect(logger.error).toHaveBeenCalledWith(
        { contactCode: 'P999999', status: 502, error: 'Request failed' },
        'tenfast-adapter.getTenantByContactCode'
      )
      expect(
        JSON.stringify(jest.mocked(logger.error).mock.calls)
      ).not.toContain('secret-token')
    })

    it('returns an error when Tenfast answers with a server error', async () => {
      // Arrange
      mockAxios.request.mockRejectedValue(
        new Error('Request failed with status code 500')
      )

      // Act
      const result = await getTenantByContactCode('P999999')

      // Assert
      expect(result).toEqual({
        ok: false,
        err: 'Request failed with status code 500',
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

  describe(getRentalProperty, () => {
    it('should return transformed rental property when request is successful', async () => {
      const mockProperty = TenfastRentalPropertyFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockProperty,
      })

      const result = await getRentalProperty(mockProperty.externalId)

      assert(result.ok)
      expect(result.data.rentalPropertyId).toBe(mockProperty.externalId)
      assert(result.data.address !== undefined)
      expect(result.data.address.street).toBe(mockProperty.postadress)
      expect(mockAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/v1/hyresvard/extras/hyresobjekt/${encodeURIComponent(mockProperty.externalId)}`,
          params: expect.objectContaining({ hyresvard: 'test-hyresvard-id' }),
        })
      )
    })

    it('accepts a parking space without skvNummer (AVTAL-348)', async () => {
      const { skvNummer: _, ...parkingSpace } =
        TenfastRentalPropertyFactory.build({ typ: 'parkering' })
      mockAxios.request.mockResolvedValue({ status: 200, data: parkingSpace })

      const result = await getRentalProperty(parkingSpace.externalId)

      assert(result.ok)
      expect(result.data.apartmentNumber).toBe(0)
    })

    it('should return error when rental property is not found (404)', async () => {
      mockAxios.request.mockResolvedValue({
        status: 404,
        data: { error: 'Not found' },
      })

      const result = await getRentalProperty('UNKNOWN-CODE')

      expect(result).toEqual({
        ok: false,
        err: 'Rental property with rentalPropertyCode UNKNOWN-CODE not found',
      })
    })

    it('should return error when request fails with non-200 status', async () => {
      mockAxios.request.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
      })

      const result = await getRentalProperty('CODE')

      expect(result).toEqual({ ok: false, err: 'Internal Server Error' })
    })

    it('should return schema-error when response format is invalid', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { notAProperty: true },
      })

      const result = await getRentalProperty('CODE')

      assert(!result.ok)
      expect(result.err).toBe('schema-error')
    })
  })

  describe(getLease, () => {
    it('should return transformed lease when request is successful', async () => {
      const mockLease = TenfastLeaseFactory.build()
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockLease,
      })

      const result = await getLease(mockLease.externalId)

      assert(result.ok)
      expect(result.data.leaseId).toBe(mockLease.externalId)
      expect(mockAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/v1/hyresvard/extras/avtal/${encodeURIComponent(mockLease.externalId)}`,
          params: expect.objectContaining({
            hyresvard: 'test-hyresvard-id',
            populate: 'hyresobjekt,hyresgaster',
          }),
        })
      )
    })

    it.each([
      ['bostad', LeaseType.HousingContract],
      ['parkering', LeaseType.ParkingSpaceContract],
      ['lokal', LeaseType.CommercialTenantContract],
      ['förråd', LeaseType.CommercialTenantContract],
      ['Förråd', LeaseType.CommercialTenantContract],
      ['forrad', LeaseType.CommercialTenantContract],
      ['unknown', LeaseType.OtherContract],
    ])('maps rental object typ "%s" to %s', async (typ, expected) => {
      const mockLease = TenfastLeaseFactory.build({
        hyresobjekt: [TenfastRentalPropertyFactory.build({ typ })],
      })
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockLease,
      })

      const result = await getLease(mockLease.externalId)

      assert(result.ok)
      expect(result.data.type).toBe(expected)
    })

    it('should encode lease IDs containing slashes correctly', async () => {
      const leaseId = '306-008-01-0201/02'
      mockAxios.request.mockResolvedValue({
        status: 404,
        data: {},
      })

      await getLease(leaseId)

      expect(mockAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/v1/hyresvard/extras/avtal/306-008-01-0201%2F02`,
        })
      )
    })

    it('should return error when lease is not found (404)', async () => {
      mockAxios.request.mockResolvedValue({
        status: 404,
        data: {},
      })

      const result = await getLease('UNKNOWN-LEASE-ID')

      expect(result).toEqual({
        ok: false,
        err: 'Lease with leaseId UNKNOWN-LEASE-ID not found',
      })
    })

    it('should return error when request fails with non-200 status', async () => {
      mockAxios.request.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
      })

      const result = await getLease('LEASE-ID')

      expect(result).toEqual({ ok: false, err: 'Internal Server Error' })
    })

    it('should return schema-error when response format is invalid', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { notALease: true },
      })

      const result = await getLease('LEASE-ID')

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

      expect(mockAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/v1/hyresvard/hyror',
          params: expect.objectContaining({
            hyresvard: 'test-hyresvard-id',
            hyresgast: 'tenant-123',
            paginate: 'false',
          }),
        })
      )

      assert(result.ok)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].invoice).toMatchObject({
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
      expect(result.data[0].invoice.invoiceRows).toHaveLength(1)
      expect(result.data[0].invoice.invoiceRows[0]).toMatchObject({
        amount: 1000,
        rentArticle: 'HYRAB',
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
        vat: 0,
        printGroup: 'Hyra bostad',
      })
    })

    it('maps tenfast deferral source when grace period is present on invoice', async () => {
      const mockInvoices = [
        TenfastInvoiceFactory.build({
          gracePeriod: {
            endDate: '2026-06-30',
            reason: 'Betalningsplan',
            madeBy: 'user-123',
            madeByEmail: 'admin@mimer.nu',
          },
        }),
      ]
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: mockInvoices, prev: null, next: null, totalCount: 1 },
      })

      const result = await getInvoicesForTenant('tenant-123')

      assert(result.ok)
      expect(result.data[0].tenfastDeferral).toEqual({
        reason: 'Betalningsplan',
        madeBy: 'admin@mimer.nu',
      })
      expect(result.data[0].invoice.deferral).toBeUndefined()
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
        data: { records: paidInvoice, prev: null, next: null, totalCount: 1 },
      })

      const result = await getInvoicesForTenant('tenant-123')

      assert(result.ok)
      expect(result.data[0].invoice.paymentStatus).toBe(PaymentStatus.Paid)
      expect(result.data[0].invoice.remainingAmount).toBe(0)
    })

    it('falls back to empty ocr when invoice has no ocrNumber', async () => {
      const invoices = [
        TenfastInvoiceFactory.build({
          ocrNumber: undefined,
          hyror: [TenfastInvoiceRowFactory.build()],
        }),
      ]

      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: invoices, prev: null, next: null, totalCount: 1 },
      })

      const result = await getInvoicesForTenant('tenant-123')

      assert(result.ok)
      expect(result.data[0].invoice.invoiceId).toBe('')
      expect(result.data[0].invoice.reference).toBe('')
    })

    it('parses draft invoices but excludes them from results', async () => {
      const invoices = [
        TenfastInvoiceFactory.build({
          state: 'ny',
          ocrNumber: '55123456',
          hyror: [TenfastInvoiceRowFactory.build()],
        }),
        TenfastInvoiceFactory.build({
          state: 'draft',
          ocrNumber: '55999999',
          hyror: [TenfastInvoiceRowFactory.build()],
        }),
      ]

      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: invoices, prev: null, next: null, totalCount: 2 },
      })

      const result = await getInvoicesForTenant('tenant-123')

      assert(result.ok)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].invoice.invoiceId).toBe('55123456')
    })
  })

  describe(getInvoicesByContactCode, () => {
    // Tenfast references an article on an invoice row by its internal id.
    const articleId = '6af2c8b04b883398396c10bd'

    const mockTenfast = (articleResponse: { status: number; data: unknown }) =>
      mockAxios.request.mockImplementation(async (config: { url?: string }) => {
        if (config.url?.includes('/extras/hyresgaster/')) {
          return { status: 200, data: TenfastTenantFactory.build() }
        }
        if (config.url?.includes('/articles/')) {
          return articleResponse
        }
        return {
          status: 200,
          data: TenfastInvoicesByTenantIdResponseFactory.build({
            records: [
              TenfastInvoiceFactory.build({
                hyror: [
                  TenfastInvoiceRowFactory.build({ article: articleId }),
                  TenfastInvoiceRowFactory.build({ article: articleId }),
                ],
              }),
            ],
          }),
        }
      })

    it('shows the article code instead of the Tenfast article id on invoice rows', async () => {
      // Arrange
      mockTenfast({
        status: 200,
        data: TenfastRentArticleFactory.build({
          _id: articleId,
          code: 'HYRAB',
        }),
      })

      // Act
      const invoices = await getInvoicesByContactCode('P123456')

      // Assert
      const rows = invoices[0].invoice.invoiceRows
      expect(rows.map((row) => row.rentArticle)).toEqual(['HYRAB', 'HYRAB'])
    })

    it('looks up each article once, even when several rows use it', async () => {
      // Arrange
      mockTenfast({
        status: 200,
        data: TenfastRentArticleFactory.build({
          _id: articleId,
          code: 'HYRAB',
        }),
      })

      // Act
      await getInvoicesByContactCode('P123456')

      // Assert
      const articleRequests = mockAxios.request.mock.calls.filter(([config]) =>
        config.url?.includes('/articles/')
      )
      expect(articleRequests).toHaveLength(1)
    })

    it('keeps the article id when the article cannot be fetched', async () => {
      // Arrange
      mockTenfast({ status: 404, data: {} })

      // Act
      const invoices = await getInvoicesByContactCode('P123456')

      // Assert
      const rows = invoices[0].invoice.invoiceRows
      expect(rows.map((row) => row.rentArticle)).toEqual([articleId, articleId])
    })

    it('gives each row the code of its own article and leaves rows without an article alone', async () => {
      // Arrange
      const feeArticleId = '6af2c8b04b883398396c10d0'
      const missingArticleId = '6af2c8b04b883398396c10ff'
      const codeById: Record<string, string> = {
        [articleId]: 'HYRAB',
        [feeArticleId]: 'HYRESSATT',
      }
      mockAxios.request.mockImplementation(async (config: { url?: string }) => {
        if (config.url?.includes('/extras/hyresgaster/')) {
          return { status: 200, data: TenfastTenantFactory.build() }
        }
        if (config.url?.includes('/articles/')) {
          const id = config.url.split('/articles/')[1]
          return codeById[id]
            ? {
                status: 200,
                data: TenfastRentArticleFactory.build({
                  _id: id,
                  code: codeById[id],
                }),
              }
            : { status: 404, data: {} }
        }
        return {
          status: 200,
          data: TenfastInvoicesByTenantIdResponseFactory.build({
            records: [
              TenfastInvoiceFactory.build({
                hyror: [
                  TenfastInvoiceRowFactory.build({ article: articleId }),
                  TenfastInvoiceRowFactory.build({ article: feeArticleId }),
                  TenfastInvoiceRowFactory.build({ article: missingArticleId }),
                  TenfastInvoiceRowFactory.build({ article: null }),
                ],
              }),
            ],
          }),
        }
      })

      // Act
      const invoices = await getInvoicesByContactCode('P123456')

      // Assert
      const rows = invoices[0].invoice.invoiceRows
      expect(rows.map((row) => row.rentArticle)).toEqual([
        'HYRAB',
        'HYRESSATT',
        missingArticleId,
        null,
      ])
    })
  })

  describe(getInvoiceByOcr, () => {
    const ocr = '55123456'
    const mockInvoice = TenfastInvoiceByOcrResponseFactory.build()

    it('should return transformed invoice data when found', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockInvoice,
      })

      const result = await getInvoiceByOcr(ocr)

      assert(result.ok)
      expect(result.data?.invoice).toMatchObject({
        amount: 1000,
        paidAmount: 500,
        remainingAmount: 500,
        invoiceId: ocr,
        paymentStatus: PaymentStatus.Unpaid,
      })
      expect(mockAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/v1/hyresvard/extras/hyror/${ocr}`,
          params: { hyresvard: 'test-hyresvard-id', populate: 'avtal' },
        })
      )
    })

    it('should return null when no invoice is found', async () => {
      mockAxios.request.mockResolvedValue({
        status: 404,
        data: {},
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

      const result = await getInvoiceByOcr(ocr)

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

    it('should accept articles without label, type and accountNr', async () => {
      // Newer articles from the Tenfast API no longer include label, type
      // or a top-level accountNr (title/defaultLabel are used instead).
      const mockArticle = {
        _id: '6a0ed9d2c08642aaffb6323a',
        hyresvard: '6909970c8825e06c8eca329b',
        createdAt: '2026-05-21T10:09:22.520Z',
        updatedAt: '2026-05-21T10:09:22.520Z',
        title: 'Ersättning för värme och kyla',
        defaultLabel: 'Ersättning för värme och kyla',
        code: 'NAVETVÄRMEM',
        accountConfigurations: [
          {
            projectCode: '',
            accountNr: 3016,
            categoryCode: 'Intäkter',
            debitType: 'HYRA',
            costCenter: '0061',
            property: '26001',
            freeText: '20006',
          },
        ],
        consolidationLabel: '',
        rentalLoss: false,
        vat: 0,
        category: 'Hyra/Inkasso',
        description: '',
        includeInContract: true,
        adjustmentType: 'negotiation',
      }
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: mockArticle,
      })

      const result = await getInvoiceArticle('NAVETVÄRMEM')

      expect(result).toEqual({
        ok: true,
        data: {
          _id: mockArticle._id,
          hyresvard: mockArticle.hyresvard,
          createdAt: mockArticle.createdAt,
          title: mockArticle.title,
          code: mockArticle.code,
          includeInContract: true,
          accountConfigurations: mockArticle.accountConfigurations,
        },
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
        err: 'not-found',
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

    it('returns the tenant ids of the matched lease', async () => {
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
              hyresgaster: ['tenant-1', { _id: 'tenant-2' }] as any,
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
        tenantIds: ['tenant-1', 'tenant-2'],
      })
    })
  })

  describe(getLeasesByTenantId, () => {
    const makeLease = (overrides: object = {}) => ({
      externalId: '306-008-01-0302/12',
      stage: 'upcoming',
      startDate: '2026-11-01',
      endDate: null,
      hyresobjekt: [{ _id: 'obj-1', typ: 'bostad' }],
      ...overrides,
    })

    const makePage = (records: object[], next: string | null = null) => ({
      status: 200,
      data: { records, prev: null, next, totalCount: records.length },
    })

    it('fetches the leases of the tenant with rental objects populated', async () => {
      mockAxios.request.mockResolvedValueOnce(makePage([makeLease()]))

      const result = await getLeasesByTenantId('tenant-1')

      expect(mockAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/v1/hyresvard/avtal',
          params: expect.objectContaining({
            hyresgast: 'tenant-1',
            populate: 'hyresobjekt',
          }),
        })
      )
      expect(result).toEqual({
        ok: true,
        data: [
          {
            leaseId: '306-008-01-0302/12',
            stage: 'upcoming',
            startDate: new Date('2026-11-01'),
            endDate: null,
            isResidential: true,
          },
        ],
      })
    })

    it.each([
      ['a parking space', [{ _id: 'obj-1', typ: 'parkering' }], false],
      ['an unpopulated rental object', ['obj-1'], false],
      ['a rental object without type', [{ _id: 'obj-1' }], false],
      [
        'a residential and a storage object',
        [
          { _id: 'obj-1', typ: 'forrad' },
          { _id: 'obj-2', typ: 'Bostad' },
        ],
        true,
      ],
    ])(
      'tells whether a lease on %s is residential',
      async (_, hyresobjekt, isResidential) => {
        mockAxios.request.mockResolvedValueOnce(
          makePage([makeLease({ hyresobjekt })])
        )

        const result = await getLeasesByTenantId('tenant-1')

        assert(result.ok)
        expect(result.data[0].isResidential).toBe(isResidential)
      }
    )

    it('follows pagination', async () => {
      mockAxios.request
        .mockResolvedValueOnce({
          status: 200,
          data: {
            records: [makeLease({ externalId: 'a/01' })],
            prev: null,
            next: 'cursor-1',
            totalCount: 2,
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            records: [makeLease({ externalId: 'b/01' })],
            prev: 'cursor-1',
            next: null,
            totalCount: 2,
          },
        })

      const result = await getLeasesByTenantId('tenant-1')

      assert(result.ok)
      expect(result.data.map((lease) => lease.leaseId)).toEqual([
        'a/01',
        'b/01',
      ])
      expect(mockAxios.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ paginate: 'cursor-1' }),
        })
      )
    })

    it('stops when a page has no records', async () => {
      mockAxios.request.mockResolvedValue({
        status: 200,
        data: { records: [], prev: null, next: 'cursor-1', totalCount: 5 },
      })

      const result = await getLeasesByTenantId('tenant-1')

      expect(result).toEqual({ ok: true, data: [] })
      expect(mockAxios.request).toHaveBeenCalledTimes(1)
    })

    it('returns an error on unexpected status', async () => {
      mockAxios.request.mockResolvedValueOnce({ status: 500, data: {} })

      const result = await getLeasesByTenantId('tenant-1')

      expect(result).toEqual({ ok: false, err: 'unknown' })
    })

    it('returns an error when the response does not parse', async () => {
      mockAxios.request.mockResolvedValueOnce({
        status: 200,
        data: { records: [{ stage: 'active' }] },
      })

      const result = await getLeasesByTenantId('tenant-1')

      expect(result).toEqual({ ok: false, err: 'unknown' })
    })

    it('returns an error when the request throws', async () => {
      mockAxios.request.mockRejectedValueOnce(new Error('network'))

      const result = await getLeasesByTenantId('tenant-1')

      expect(result).toEqual({ ok: false, err: 'unknown' })
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

  it('returns not-found when OCR lookup returns 404', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 404,
      data: {},
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

  it('returns schema-error when OCR lookup response fails schema parse', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { unexpected: true },
    })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: false, err: 'schema-error' })
  })

  it('records the payment and returns ok', async () => {
    const invoice = TenfastInvoiceFactory.build()

    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: invoice,
      })
      .mockResolvedValueOnce({
        status: 201,
        data: {},
      })

    const result = await recordPaymentForInvoice(payment)

    expect(result).toEqual({ ok: true, data: null })
    expect(mockAxios.request).toHaveBeenCalledTimes(2)
    expect(mockAxios.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: `/v1/hyresvard/extras/hyror/${payment.ocr}`,
      })
    )
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
        data: invoice,
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
        data: invoice,
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
  const mockInvoice = TenfastInvoiceFactory.build({
    _id: tenfastId,
    ocrNumber: ocr,
  })

  it('returns pdf data and content-disposition on success', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 mock')
    mockAxios.request
      .mockResolvedValueOnce({ status: 200, data: mockInvoice })
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

  it('returns the pdf for an invoice covering a parking space (AVTAL-348)', async () => {
    // A co-invoiced apartment and parking space. Tenfast leaves out
    // skvNummer for the parking space.
    const [apartmentLease] = mockInvoice.avtal
    const { skvNummer: _, ...parkingSpace } = apartmentLease.hyresobjekt[0]
    const coInvoiced = {
      ...mockInvoice,
      avtal: [
        apartmentLease,
        {
          ...apartmentLease,
          _id: 'lease-parking',
          hyresobjekt: [{ ...parkingSpace, externalId: '806-721-00-0018' }],
        },
      ],
    }
    mockAxios.request
      .mockResolvedValueOnce({ status: 200, data: coInvoiced })
      .mockResolvedValueOnce({
        status: 200,
        data: Buffer.from('%PDF-1.4 mock'),
        headers: {},
      })

    const result = await getInvoicePdf(ocr)

    expect(result.ok).toBe(true)
  })

  it('returns not-found when OCR lookup returns 404', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 404,
      data: {},
    })

    const result = await getInvoicePdf(ocr)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns not-found when download-pdf returns 404', async () => {
    mockAxios.request
      .mockResolvedValueOnce({ status: 200, data: mockInvoice })
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

  const invoiceRecord = TenfastInvoiceFactory.build({
    _id: 'tenfast-invoice-id-123',
    ocrNumber: params.invoiceOcr,
  })

  it('returns ok when grace period is set successfully', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: invoiceRecord,
      })
      .mockResolvedValueOnce({ status: 200, data: {} })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: true, data: null })
  })

  it('calls extras hyror lookup then grace-period endpoint with correct body', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: invoiceRecord,
      })
      .mockResolvedValueOnce({ status: 200, data: {} })

    await setGracePeriod(params)

    expect(mockAxios.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: `/v1/hyresvard/extras/hyror/${params.invoiceOcr}`,
      })
    )
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

  it('returns not-found when OCR lookup returns 404', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 404,
      data: {},
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

  it('returns schema-error when OCR lookup response fails schema parse', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { unexpected: true },
    })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'schema-error' })
  })

  it('returns not-found when grace-period endpoint returns 404', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: invoiceRecord,
      })
      .mockResolvedValueOnce({ status: 404, data: {} })

    const result = await setGracePeriod(params)

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns unknown when grace-period endpoint returns unexpected status', async () => {
    mockAxios.request
      .mockResolvedValueOnce({
        status: 200,
        data: invoiceRecord,
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

describe('TenfastInvoicesByExportedResponseSchema', () => {
  // Regression test for AVTAL-36: the /v1/hyresvard/hyror endpoint returns
  // lease objects that are far leaner than the full TenfastLeaseSchema (no
  // populated hyresobjekt, no reference/invitationsToRegister/canDelete/
  // depositState, etc). The schema must accept those payloads.
  it('parses invoices whose avtal records only carry the fields used downstream', () => {
    const TenfastInvoicesByExportedResponseSchema = jest.requireActual(
      '@src/common/adapters/tenfast/schemas'
    ).TenfastInvoicesByExportedResponseSchema

    const leanInvoice = {
      ...TenfastInvoiceFactory.build(),
      avtal: [
        {
          _id: 'lease-lean',
          externalId: '306-008-01-0201/01',
          hyresgaster: [
            {
              _id: 'tenant-1',
              externalId: 'P1',
              displayName: 'Lean Tenant',
            },
          ],
        },
      ],
    }

    const parsed = TenfastInvoicesByExportedResponseSchema.safeParse({
      records: [leanInvoice],
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.records[0]).toMatchObject({
        contractCode: '306-008-01-0201/01',
        recipientContactCode: 'P1',
        recipientName: 'Lean Tenant',
      })
    }
  })
})

describe(listNewOutboundExports, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const makeListResponse = (
    records: object[],
    opts: { next?: string | null; totalCount?: number } = {}
  ) => ({
    status: 200,
    data: {
      records,
      prev: null,
      next: opts.next ?? null,
      totalCount: opts.totalCount ?? records.length,
    },
  })

  it('requests only NEW exports from the stralfors provider', async () => {
    mockAxios.request.mockResolvedValueOnce(makeListResponse([]))

    await listNewOutboundExports()

    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/v1/hyresvard/outbound-exports',
        params: expect.objectContaining({
          status: 'NEW',
          provider: 'stralfors',
          hyresvard: 'test-hyresvard-id',
        }),
      })
    )
  })

  it('returns all records from a single page', async () => {
    const exports = [
      TenfastOutboundExportFactory.build({ _id: 'id-1' }),
      TenfastOutboundExportFactory.build({ _id: 'id-2' }),
    ]
    mockAxios.request.mockResolvedValueOnce(makeListResponse(exports))

    const result = await listNewOutboundExports()

    expect(result).toEqual({ ok: true, data: exports })
  })

  it('follows pagination until next is null', async () => {
    const page1 = [TenfastOutboundExportFactory.build({ _id: 'id-1' })]
    const page2 = [TenfastOutboundExportFactory.build({ _id: 'id-2' })]
    mockAxios.request
      .mockResolvedValueOnce(
        makeListResponse(page1, { next: 'cursor-abc', totalCount: 2 })
      )
      .mockResolvedValueOnce(makeListResponse(page2, { totalCount: 2 }))

    const result = await listNewOutboundExports()

    expect(mockAxios.request).toHaveBeenCalledTimes(2)
    expect(mockAxios.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        params: expect.objectContaining({ paginate: 'cursor-abc' }),
      })
    )
    expect(result).toEqual({ ok: true, data: [...page1, ...page2] })
  })

  it('returns unknown when response status is not 200', async () => {
    mockAxios.request.mockResolvedValueOnce({ status: 500, data: {} })

    const result = await listNewOutboundExports()

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown when response fails schema validation', async () => {
    mockAxios.request.mockResolvedValueOnce({
      status: 200,
      data: { unexpected: true },
    })

    const result = await listNewOutboundExports()

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on thrown error', async () => {
    mockAxios.request.mockRejectedValueOnce(new Error('Network error'))

    const result = await listNewOutboundExports()

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(getRentalLosses, () => {
  const reportId = '6aeafb7fbe29b7ac851dbf2b'
  const company = {
    tenfastId: 'test-hyresvard-id',
    xpandId: '001',
  } as any

  const buildRentalLoss = (externalId: string, hyror: any[]) => ({
    month: '2026-11',
    hyresvard: { id: 'test-hyresvard-id', name: 'Mimer' },
    hyresobjekt: {
      id: `id-${externalId}`,
      externalId,
      fastighetId: 'fastighet',
      postadress: 'Gatan 1',
      postnummer: '722 11',
      stad: 'VÄSTERÅS',
      skvNummer: null,
      objektnummer: '0201',
      typ: 'Bostad',
      hyror,
    },
    days: { month: 30, contracted: 0, uncontracted: 30 },
    uncontractedIntervals: [{ from: '2026-11-01', to: '2026-11-30' }],
    avtalIds: [],
    relatedAvtalCoverage: [],
  })

  const rentRow = {
    _id: 'hyra-1',
    label: 'Hyra',
    amount: 3000,
    vat: 0,
    hyresobjekt: 'id-RO1',
    article: 'article-1',
    includeInContract: true,
  }

  const article = {
    ...TenfastRentArticleFactory.build(),
    code: 'HYRA',
    accountConfigurations: [
      {
        accountNr: 3015,
        categoryCode: 'Intäkter',
        debitType: 'HYRESBORTFALL',
        costCenter: '',
        property: '',
        freeText: '',
        projectCode: '',
      },
      {
        accountNr: 3085,
        categoryCode: 'Kostnad/Inköp',
        debitType: 'HYRESBORTFALL',
        costCenter: '',
        property: '',
        freeText: '',
        projectCode: '',
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns every rental loss and lists objects without rent rows separately', async () => {
    const rentalLosses = [
      buildRentalLoss('EMPTY1', []),
      ...Array.from({ length: 11 }, (_, i) =>
        buildRentalLoss(`RO${i}`, [rentRow])
      ),
      buildRentalLoss('EMPTY2', []),
    ]
    mockAxios.request.mockImplementation(async (config: any) =>
      config.url.includes('/reports/')
        ? { status: 200, data: rentalLosses }
        : { status: 200, data: article }
    )

    const result = await getRentalLosses(company, reportId)

    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          `/v1/hyresvard/reports/${reportId}/download`
        ),
      })
    )
    assert(result.ok)
    expect(result.data.rentalLosses).toHaveLength(11)
    expect(result.data.rentalLosses[0].rentalLossRows).toHaveLength(1)
    expect(result.data.rentalObjectsWithoutRentRows).toEqual([
      'EMPTY1',
      'EMPTY2',
    ])
    expect(result.data.errors).toEqual([])
  })

  it('reports rent rows whose article cannot be retrieved', async () => {
    mockAxios.request.mockImplementation(async (config: any) =>
      config.url.includes('/reports/')
        ? { status: 200, data: [buildRentalLoss('RO1', [rentRow])] }
        : { status: 404, data: {} }
    )

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    expect(result.data.errors).toEqual([
      {
        rentalObject: 'RO1',
        error: 'Kunde inte hämta hyresartikel article-1',
      },
    ])
  })

  const mockReport = (rentalLosses: any[]) =>
    mockAxios.request.mockImplementation(async (config: any) =>
      config.url.includes('/reports/')
        ? { status: 200, data: rentalLosses }
        : { status: 200, data: article }
    )

  const withProration = (rentalLoss: any, amounts: number[]) => ({
    ...rentalLoss,
    proration: {
      simplifiedInterval: { from: '2026-11-01', to: '2026-11-30' },
      hyraRows: amounts.map((amount, i) => ({
        ...rentRow,
        _id: `prorated-${i}`,
        amount,
        accountingRows: null,
        proratedInterval: { from: '2026-11-01', to: '2026-11-30' },
      })),
    },
  })

  it('leaves out rent rows that are not valid during the uncontracted period', async () => {
    mockReport([
      buildRentalLoss('RO1', [
        { ...rentRow, _id: 'old', amount: 1000, to: '2026-10-31' },
        { ...rentRow, _id: 'current', amount: 3000 },
        { ...rentRow, _id: 'new', amount: 5000, from: '2026-12-01' },
      ]),
    ])

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    expect(result.data.rentalLosses).toHaveLength(1)
    expect(
      result.data.rentalLosses[0].rentalLossRows.map((row) => row.amount)
    ).toEqual([3000])
  })

  it('prorates a rent row starting inside the uncontracted period to its own dates', async () => {
    mockReport([
      buildRentalLoss('RO1', [
        { ...rentRow, amount: 3000, from: '2026-11-21', to: null },
      ]),
    ])

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    const [row] = result.data.rentalLosses[0].rentalLossRows
    // 10 of 30 days
    expect(row.amount).toBe(1000)
    expect(row.fromDate).toEqual(new Date('2026-11-21'))
    expect(row.toDate).toEqual(new Date('2026-11-30'))
  })

  it('accepts objects without proration, as Tenfast returns for contracted objects', async () => {
    mockReport([
      {
        ...buildRentalLoss('RO1', [rentRow]),
        days: { month: 30, contracted: 30, uncontracted: 0 },
        proration: null,
      },
      { ...buildRentalLoss('RO2', [rentRow]), proration: null },
    ])

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    expect(result.data.rentalLosses.map((loss) => loss.rentalObject)).toEqual([
      'RO2',
    ])
    expect(result.data.checksumMismatches).toEqual([])
  })

  it('reports no checksum mismatch when the amount matches Tenfast proration', async () => {
    mockReport([withProration(buildRentalLoss('RO1', [rentRow]), [3000])])

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    expect(result.data.checksumMismatches).toEqual([])
  })

  it('reports a checksum mismatch but still returns the rental loss', async () => {
    mockReport([withProration(buildRentalLoss('RO1', [rentRow]), [2500])])

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    expect(result.data.rentalLosses).toHaveLength(1)
    expect(result.data.checksumMismatches).toEqual([
      {
        rentalObject: 'RO1',
        month: '2026-11',
        calculatedAmount: 3000,
        tenfastAmount: 2500,
        diff: 500,
      },
    ])
  })

  it('checks rows left out for missing rental loss accounts against Tenfast too', async () => {
    mockAxios.request.mockImplementation(async (config: any) =>
      config.url.includes('/reports/')
        ? {
            status: 200,
            data: [withProration(buildRentalLoss('RO1', [rentRow]), [3000])],
          }
        : { status: 200, data: { ...article, accountConfigurations: [] } }
    )

    const result = await getRentalLosses(company, reportId)

    assert(result.ok)
    expect(result.data.rentalLosses[0].rentalLossRows).toEqual([])
    expect(result.data.checksumMismatches).toEqual([])
  })
})

describe(markInvoicesAsExported, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks every invoice and returns no failures when all succeed', async () => {
    mockAxios.request.mockResolvedValue({ status: 200, data: {} })
    const invoices = [
      InvoiceFactory.build({ invoiceId: '1', externalId: 'ext-1' }),
      InvoiceFactory.build({ invoiceId: '2', externalId: 'ext-2' }),
    ]

    const failures = await markInvoicesAsExported(invoices)

    expect(failures).toEqual([])
    expect(mockAxios.request).toHaveBeenCalledTimes(2)
    expect(mockAxios.request.mock.calls[1][0].url).toBe(
      '/v1/hyresvard/hyror/ext-2/manual-export'
    )
  })

  it('keeps going after a failed invoice and returns the failures', async () => {
    mockAxios.request
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({ status: 503, data: {} })
      .mockResolvedValueOnce({ status: 200, data: {} })
    const invoices = [
      InvoiceFactory.build({ invoiceId: '1', externalId: 'ext-1' }),
      InvoiceFactory.build({ invoiceId: '2', externalId: 'ext-2' }),
      InvoiceFactory.build({ invoiceId: '3', externalId: 'ext-3' }),
      InvoiceFactory.build({ invoiceId: '4', externalId: undefined }),
    ]

    const failures = await markInvoicesAsExported(invoices)

    expect(mockAxios.request).toHaveBeenCalledTimes(3)
    expect(failures).toEqual([
      { invoiceNumber: '1', error: 'request-failed' },
      { invoiceNumber: '2', error: 'request-failed', status: 503 },
      { invoiceNumber: '4', error: 'missing-external-id' },
    ])
  })
})

describe(getInvoicesNotExported, () => {
  const company = {
    tenfastId: 'test-hyresvard-id',
    xpandId: '001',
  } as MimerCompany // only the ids are read by getInvoicesNotExported

  const article = {
    ...TenfastRentArticleFactory.build(),
    code: 'HYRA',
    accountConfigurations: [
      {
        accountNr: 3011,
        categoryCode: 'Intäkter',
        debitType: 'HYRA',
        costCenter: '',
        property: '',
        freeText: '',
        projectCode: '',
      },
    ],
  }

  // Answers the invoice list with the given rows and article lookups with
  // the given response. Rental object lookups get 404 and are left as is.
  const mockTenfast = (
    rows: ReturnType<typeof TenfastInvoiceRowFactory.build>[],
    articleResponse: () => Promise<{ status: number; data?: unknown }>
  ) => {
    const record = TenfastInvoiceFactory.build({ hyror: rows })
    mockAxios.request.mockImplementation(async (config) => {
      if (config.url === '/v1/hyresvard/hyror') {
        return { status: 200, data: { records: [record] } }
      }
      if (config.url?.startsWith('/v1/hyresvard/articles/')) {
        return articleResponse()
      }
      return { status: 404, data: {} }
    })
    return record
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports an invoice whose rows all have an article with accounting', async () => {
    mockTenfast(
      [TenfastInvoiceRowFactory.build({ article: 'a-1' })],
      async () => ({
        status: 200,
        data: article,
      })
    )

    const result = await getInvoicesNotExported(1000, company)

    assert(result.ok)
    expect(result.data.errors).toEqual([])
    expect(result.data.invoices).toHaveLength(1)
    expect(result.data.invoices[0].invoiceRows[0]).toMatchObject({
      account: '3011',
    })
  })

  it('leaves out an invoice with a row that has no article', async () => {
    const record = mockTenfast(
      [TenfastInvoiceRowFactory.build({ article: null })],
      async () => ({ status: 200, data: article })
    )

    const result = await getInvoicesNotExported(1000, company)

    assert(result.ok)
    expect(result.data.invoices).toEqual([])
    expect(result.data.errors).toEqual([
      {
        invoiceNumber: record.ocrNumber,
        code: 'missing-rent-article',
        error: 'Minst en hyresrad på avin saknar hyresartikel',
      },
    ])
  })

  it('leaves out an invoice whose article does not exist in Tenfast', async () => {
    const record = mockTenfast(
      [TenfastInvoiceRowFactory.build({ article: 'a-1' })],
      async () => ({ status: 404, data: {} })
    )

    const result = await getInvoicesNotExported(1000, company)

    assert(result.ok)
    expect(result.data.invoices).toEqual([])
    expect(result.data.errors).toEqual([
      {
        invoiceNumber: record.ocrNumber,
        code: 'rent-article-not-found',
        rentArticle: 'a-1',
        error: 'Hyresartikeln a-1 finns inte i Tenfast',
      },
    ])
  })

  it('leaves out an invoice whose article lookup fails', async () => {
    const record = mockTenfast(
      [TenfastInvoiceRowFactory.build({ article: 'a-1' })],
      async () => {
        throw new Error('socket hang up')
      }
    )

    const result = await getInvoicesNotExported(1000, company)

    assert(result.ok)
    expect(result.data.invoices).toEqual([])
    expect(result.data.errors).toEqual([
      {
        invoiceNumber: record.ocrNumber,
        code: 'rent-article-fetch-failed',
        rentArticle: 'a-1',
        error: 'Kunde inte hämta hyresartikeln a-1 från Tenfast',
      },
    ])
  })
})
