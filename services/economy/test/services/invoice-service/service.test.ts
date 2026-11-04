import {
  getInvoiceDetails,
  getPublicInvoiceByOcr,
  getBatchContactsCsv,
  getAutogiroConsent,
  exportRentalInvoicesAccounting,
  createAccounting,
  createRentalLossAccounting,
  exportRentalLosses,
  handleRentalBlocks,
  enrichRentalLossesWithAccounting,
  uploadCsvFiles,
  uploadRentalLossCsvFile,
  createLedgerRows,
  createAggregatedTotalRow,
} from '@src/services/invoice-service/service'
import {
  MimerCompany,
  InvoiceWithAccounting,
  RentalLoss,
  AggregatedRow,
  RentalBlockWithAccounting,
} from '@src/common/types/typesv2'

const mockCompanies: MimerCompany[] = [
  {
    name: 'Mimer',
    xpandId: '001',
    tenfastId: 'tf-001',
    roundOffCostCode: '999',
  },
  { name: 'Other', xpandId: '002', tenfastId: 'tf-002' },
]

jest.mock('@src/common/config', () => ({
  __esModule: true,
  ...jest.requireActual('@src/common/config'),
  default: {
    ...jest.requireActual('@src/common/config').default,
    get companies() {
      return mockCompanies
    },
  },
}))

// Mock database adapters
jest.mock(
  '@src/services/invoice-service/adapters/invoice-data-db-adapter',
  () => ({
    ...require('./__mocks__/invoice-data-db-adapter'),
    getCounterPartCustomers: jest.fn(),
    findCounterPartCustomer: jest.fn(),
  })
)

jest.mock('@src/services/invoice-service/adapters/xpand-db-adapter', () => ({
  getRoundOffInformation: jest.fn(),
  enrichInvoiceWithAccounting: jest.fn(),
  getActiveRentalBlocksWithAccounting: jest.fn(),
  getRentalSpecificRules: jest.fn(),
}))

jest.mock('@src/services/common/adapters/xpand-db-adapter', () => ({}))

jest.mock(
  '@src/services/invoice-service/adapters/stralfors/stralfors-adapter',
  () => ({})
)

jest.mock('@src/services/common/adapters/xledger-adapter', () => ({
  ...jest.requireActual('@src/services/common/adapters/xledger-adapter'),
  getInvoiceByInvoiceNumber: jest.fn(),
  getPeriodInformationFromDateStrings: jest.fn(() => ({
    periodStart: '',
    periods: '',
  })),
  setInvoiceRowsTaxRule: jest.fn(),
  uploadFile: jest.fn(),
}))

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  getInvoiceByOcr: jest.fn(),
  getInvoiceArticle: jest.fn(),
  getAutogiroConsentByNationalRegistrationNumber: jest.fn(),
  getInvoicesNotExported: jest.fn(),
  getRentalLosses: jest.fn(),
  markInvoicesAsExported: jest.fn(),
}))

import {
  resetMocks as resetInvoiceDbMocks,
  setupDefaultMocks as setupDefaultInvoiceDbMocks,
  getContacts,
} from './__mocks__/invoice-data-db-adapter'

// Import the actual modules to get proper typing
import {
  getInvoiceByInvoiceNumber,
  getPeriodInformationFromDateStrings,
  uploadFile,
} from '@src/services/common/adapters/xledger-adapter'
import {
  getInvoiceByOcr,
  getInvoiceArticle,
  getAutogiroConsentByNationalRegistrationNumber,
  getInvoicesNotExported,
  getRentalLosses,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import {
  getCounterPartCustomers,
  findCounterPartCustomer,
} from '@src/services/invoice-service/adapters/invoice-data-db-adapter'
import {
  getRoundOffInformation,
  enrichInvoiceWithAccounting,
  getActiveRentalBlocksWithAccounting,
  getRentalSpecificRules,
} from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { TenfastAutogiroConsentFactory } from '@test/factories'

// Assign the mocked functions
const mockGetInvoiceByInvoiceNumber = getInvoiceByInvoiceNumber as jest.Mock
const mockGetInvoiceByOcr = getInvoiceByOcr as jest.Mock
const mockGetInvoiceArticle = getInvoiceArticle as jest.Mock
const mockGetAutogiroConsent =
  getAutogiroConsentByNationalRegistrationNumber as jest.Mock
const mockGetInvoicesNotExported = getInvoicesNotExported as jest.Mock
const mockGetRentalLosses = getRentalLosses as jest.Mock
const mockGetCounterPartCustomers = getCounterPartCustomers as jest.Mock
const mockFindCounterPartCustomer = findCounterPartCustomer as jest.Mock
const mockGetRoundOffInformation = getRoundOffInformation as jest.Mock
const mockGetActiveRentalBlocksWithAccounting =
  getActiveRentalBlocksWithAccounting as jest.Mock
const mockUploadFile = uploadFile as jest.Mock
const mockGetRentalSpecificRules = getRentalSpecificRules as jest.Mock
const mockGetPeriodInformationFromDateStrings =
  getPeriodInformationFromDateStrings as jest.Mock

describe('Rental Invoice Service', () => {
  describe('getInvoiceDetails', () => {
    const mockXledgerInvoice = {
      invoice: {
        invoiceId: 'test-invoice-id',
        invoiceNumber: '55123456',
        customerCode: 'P999999',
        amount: 1000,
        invoiceRows: [],
      },
    }

    const mockTenfastInvoiceResult = {
      ok: true,
      data: {
        invoice: {
          invoiceRows: [
            {
              rentArticle: 'HYRAB',
              amount: 999.57,
              vat: 0,
              invoiceRowText: null,
            },
            {
              rentArticle: 'PARK',
              amount: 50,
              vat: 0,
              invoiceRowText: null,
            },
          ],
        },
      },
    }

    const mockArticles = [
      {
        _id: 'HYRAB',
        title: 'Hyra bostad',
      },
      {
        _id: 'PARK',
        title: 'Parkering',
      },
    ]

    beforeEach(() => {
      mockGetInvoiceByInvoiceNumber.mockReset()
      mockGetInvoiceByOcr.mockReset()
      mockGetInvoiceArticle.mockReset()
    })

    it('should return invoice details with enriched invoice rows when all data is available', async () => {
      mockGetInvoiceByInvoiceNumber.mockResolvedValue(mockXledgerInvoice)
      mockGetInvoiceByOcr.mockResolvedValue(mockTenfastInvoiceResult)
      mockGetInvoiceArticle
        .mockResolvedValueOnce({ ok: true, data: mockArticles[0] })
        .mockResolvedValueOnce({ ok: true, data: mockArticles[1] })

      const result = await getInvoiceDetails('55123456')

      expect(getInvoiceByInvoiceNumber).toHaveBeenCalledWith('55123456')
      expect(getInvoiceByOcr).toHaveBeenCalledWith('test-invoice-id')
      expect(getInvoiceArticle).toHaveBeenCalledWith('HYRAB')
      expect(getInvoiceArticle).toHaveBeenCalledWith('PARK')

      expect(result).toEqual({
        ...mockXledgerInvoice.invoice,
        invoiceRows: [
          {
            rentArticle: 'HYRAB',
            amount: 999.57,
            vat: 0,
            invoiceRowText: 'Hyra bostad',
          },
          {
            rentArticle: 'PARK',
            amount: 50,
            vat: 0,
            invoiceRowText: 'Parkering',
          },
        ],
      })
    })

    it('should return null when invoice is not found in xledger', async () => {
      mockGetInvoiceByInvoiceNumber.mockResolvedValue(null)

      const result = await getInvoiceDetails('nonexistent')

      expect(getInvoiceByInvoiceNumber).toHaveBeenCalledWith('nonexistent')
      expect(getInvoiceByOcr).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should throw error when Tenfast API returns an error', async () => {
      const mockTenfastError = 'Tenfast API error'
      mockGetInvoiceByInvoiceNumber.mockResolvedValue(mockXledgerInvoice)
      mockGetInvoiceByOcr.mockResolvedValue({
        ok: false,
        err: mockTenfastError,
      })

      await expect(getInvoiceDetails('55123456')).rejects.toMatchObject({
        message: mockTenfastError,
      })

      expect(getInvoiceByInvoiceNumber).toHaveBeenCalledWith('55123456')
      expect(getInvoiceByOcr).toHaveBeenCalledWith('test-invoice-id')
    })

    it('should return invoice without invoice rows when Tenfast data is null', async () => {
      mockGetInvoiceByInvoiceNumber.mockResolvedValue(mockXledgerInvoice)
      mockGetInvoiceByOcr.mockResolvedValue({ ok: true, data: null })

      const result = await getInvoiceDetails('55123456')

      expect(getInvoiceByInvoiceNumber).toHaveBeenCalledWith('55123456')
      expect(getInvoiceByOcr).toHaveBeenCalledWith('test-invoice-id')
      expect(getInvoiceArticle).not.toHaveBeenCalled()
      expect(result).toEqual(mockXledgerInvoice.invoice)
    })

    it('should handle invoice rows without rent articles', async () => {
      const mockTenfastResultWithoutArticles = {
        ok: true,
        data: {
          invoice: {
            invoiceRows: [
              {
                rentArticle: null,
                amount: 50,
                vat: 0,
                invoiceRowText: null,
              },
              {
                rentArticle: 'HYRAB',
                amount: 999.57,
                vat: 0,
                invoiceRowText: null,
              },
            ],
          },
        },
      }

      mockGetInvoiceByInvoiceNumber.mockResolvedValue(mockXledgerInvoice)
      mockGetInvoiceByOcr.mockResolvedValue(mockTenfastResultWithoutArticles)
      mockGetInvoiceArticle.mockResolvedValue({
        ok: true,
        data: mockArticles[0],
      })

      const result = await getInvoiceDetails('55123456')

      expect(mockGetInvoiceArticle).toHaveBeenCalledTimes(1)
      expect(mockGetInvoiceArticle).toHaveBeenCalledWith('HYRAB')

      expect(result).toEqual({
        ...mockXledgerInvoice.invoice,
        invoiceRows: [
          {
            rentArticle: null,
            amount: 50,
            vat: 0,
            invoiceRowText: null,
          },
          {
            rentArticle: 'HYRAB',
            amount: 999.57,
            vat: 0,
            invoiceRowText: 'Hyra bostad',
          },
        ],
      })
    })

    it('should handle failed article lookups gracefully', async () => {
      mockGetInvoiceByInvoiceNumber.mockResolvedValue(mockXledgerInvoice)
      mockGetInvoiceByOcr.mockResolvedValue(mockTenfastInvoiceResult)
      mockGetInvoiceArticle
        .mockResolvedValueOnce({ ok: false, err: 'Article not found' })
        .mockResolvedValueOnce({ ok: true, data: mockArticles[1] })

      const result = await getInvoiceDetails('55123456')

      expect(getInvoiceArticle).toHaveBeenCalledTimes(2)

      expect(result).toEqual({
        ...mockXledgerInvoice.invoice,
        invoiceRows: [
          {
            rentArticle: 'HYRAB',
            amount: 999.57,
            vat: 0,
            invoiceRowText: null,
          },
          {
            rentArticle: 'PARK',
            amount: 50,
            vat: 0,
            invoiceRowText: 'Parkering',
          },
        ],
      })
    })

    it('should handle duplicate rent articles correctly', async () => {
      const mockTenfastResultWithDuplicates = {
        ok: true,
        data: {
          invoice: {
            invoiceRows: [
              {
                rentArticle: 'HYRAB',
                amount: 500,
                vat: 0,
                invoiceRowText: null,
              },
              {
                rentArticle: 'HYRAB',
                amount: 499.57,
                vat: 0,
                invoiceRowText: null,
              },
            ],
          },
        },
      }

      mockGetInvoiceByInvoiceNumber.mockResolvedValue(mockXledgerInvoice)
      mockGetInvoiceByOcr.mockResolvedValue(mockTenfastResultWithDuplicates)
      mockGetInvoiceArticle
        .mockResolvedValueOnce({ ok: true, data: mockArticles[0] })
        .mockResolvedValueOnce({ ok: true, data: mockArticles[0] })

      const result = await getInvoiceDetails('55123456')

      // Should call getInvoiceArticle for each unique article ID
      expect(mockGetInvoiceArticle).toHaveBeenCalledTimes(2)
      expect(mockGetInvoiceArticle).toHaveBeenCalledWith('HYRAB')

      expect(result).toEqual({
        ...mockXledgerInvoice.invoice,
        invoiceRows: [
          {
            rentArticle: 'HYRAB',
            amount: 500,
            vat: 0,
            invoiceRowText: 'Hyra bostad',
          },
          {
            rentArticle: 'HYRAB',
            amount: 499.57,
            vat: 0,
            invoiceRowText: 'Hyra bostad',
          },
        ],
      })
    })
  })

  describe('getPublicInvoiceByOcr', () => {
    beforeEach(() => {
      mockGetInvoiceByInvoiceNumber.mockReset()
      mockGetInvoiceByOcr.mockReset()
    })

    it('returns a public invoice with deferral when xledger has deferment', async () => {
      mockGetInvoiceByOcr.mockResolvedValue({
        ok: true,
        data: {
          invoice: { invoiceId: '55123456', invoiceRows: [] },
          tenfastDeferral: {
            reason: 'Betalningsplan',
            madeBy: 'admin@mimer.nu',
          },
        },
      })
      mockGetInvoiceByInvoiceNumber.mockResolvedValue({
        invoice: { invoiceId: '55123456', invoiceRows: [] },
        defermentEndDate: new Date('2026-07-15'),
      })

      const result = await getPublicInvoiceByOcr('55123456')

      expect(result).toEqual({
        ok: true,
        data: {
          invoiceId: '55123456',
          invoiceRows: [],
          deferral: {
            endDate: new Date('2026-07-15'),
            reason: 'Betalningsplan',
            madeBy: 'admin@mimer.nu',
          },
        },
      })
    })

    it('returns invoice without deferral when xledger has no deferment', async () => {
      mockGetInvoiceByOcr.mockResolvedValue({
        ok: true,
        data: {
          invoice: { invoiceId: '55123456', invoiceRows: [] },
          tenfastDeferral: {
            reason: 'Betalningsplan',
            madeBy: 'admin@mimer.nu',
          },
        },
      })
      mockGetInvoiceByInvoiceNumber.mockResolvedValue({
        invoice: { invoiceId: '55123456', invoiceRows: [] },
      })

      const result = await getPublicInvoiceByOcr('55123456')

      expect(result).toEqual({
        ok: true,
        data: {
          invoiceId: '55123456',
          invoiceRows: [],
        },
      })
    })
  })

  describe('getBatchContactsCsv', () => {
    beforeEach(() => {
      setupDefaultInvoiceDbMocks()
    })

    afterEach(() => {
      resetInvoiceDbMocks()
      jest.clearAllMocks()
    })

    it('returns null when no contacts exist for the batch', async () => {
      getContacts.mockResolvedValueOnce([])

      const result = await getBatchContactsCsv('1337')

      expect(result).toBeNull()
    })

    it('returns a CSV string with header when contacts exist', async () => {
      getContacts.mockResolvedValueOnce([
        {
          contactCode: 'P12345',
          contactKey: '1234',
          firstName: 'Test',
          lastName: 'Tenant',
          fullName: 'Test Tenant',
          nationalRegistrationNumber: '19900101-1234',
          birthDate: new Date('1990-01-01'),
          isTenant: true,
          phoneNumbers: [],
          address: {
            street: 'Test 1',
            postalCode: '12345',
            city: 'Västerås',
            number: '',
          },
          emailAddress: 'test@example.com',
          autogiro: false,
          invoiceDeliveryMethod: 'Email',
        },
      ])

      const result = await getBatchContactsCsv('1337')

      expect(result).not.toBeNull()
      expect(result).toContain('Code;Description;Company No')
      expect(result?.split('\n').length).toBe(2)
    })
  })

  describe('getAutogiroConsent', () => {
    beforeEach(() => {
      mockGetAutogiroConsent.mockReset()
    })

    it('returns consent data when tenfast returns ok result', async () => {
      const mockConsent = TenfastAutogiroConsentFactory.build()
      mockGetAutogiroConsent.mockResolvedValue({
        ok: true,
        data: mockConsent,
      })

      const result = await getAutogiroConsent('198001011234')

      expect(mockGetAutogiroConsent).toHaveBeenCalledWith('198001011234')
      expect(result).toEqual(mockConsent)
    })

    it('returns null when no consent found', async () => {
      mockGetAutogiroConsent.mockResolvedValue({ ok: true, data: null })

      const result = await getAutogiroConsent('198001011234')

      expect(result).toBeNull()
    })

    it('throws when tenfast returns error', async () => {
      mockGetAutogiroConsent.mockResolvedValue({
        ok: false,
        err: 'API error',
      })

      await expect(getAutogiroConsent('198001011234')).rejects.toMatchObject({
        message: 'API error',
      })
    })
  })
})

const buildInvoice = (
  overrides: Partial<InvoiceWithAccounting> = {}
): InvoiceWithAccounting =>
  ({
    invoiceId: '55123456',
    leaseIds: ['705-025-03-0205/01'],
    recipientContactCode: 'P123456',
    recipientName: 'Test Tenant',
    amount: 1000,
    totalVat: 0,
    roundoff: 0,
    fromDate: new Date('2026-07-01T00:00:00.000Z'),
    toDate: new Date('2026-07-31T00:00:00.000Z'),
    invoiceDate: new Date('2026-06-15T00:00:00.000Z'),
    expirationDate: new Date('2026-06-30T00:00:00.000Z'),
    invoiceRows: [
      {
        amount: 1000,
        totalAmount: 1000,
        vat: 0,
        deduction: 0,
        account: '3012',
        costCode: '123',
        invoiceRowText: 'Hyra bostad',
      } as any,
    ],
    ...overrides,
  }) as InvoiceWithAccounting

describe('Rental Invoice Accounting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCounterPartCustomers.mockResolvedValue([])
    mockFindCounterPartCustomer.mockReturnValue(undefined)
    mockGetRoundOffInformation.mockResolvedValue({
      account: '3999',
      costCode: '123',
    })
    mockGetPeriodInformationFromDateStrings.mockReturnValue({
      periodStart: '',
      periods: '',
    })
  })

  describe('exportRentalInvoicesAccounting', () => {
    it('throws when the company cannot be found', async () => {
      await expect(exportRentalInvoicesAccounting('999')).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('throws when the invoices adapter returns an error', async () => {
      mockGetInvoicesNotExported.mockResolvedValue({ ok: false, err: 'boom' })

      await expect(exportRentalInvoicesAccounting('001')).rejects.toThrow(
        'boom'
      )
    })

    it('returns empty result when there are no invoices', async () => {
      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [], errors: undefined },
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices).toEqual([])
      expect(result.skippedInvoices).toEqual([])
    })

    it('skips invoices for internal customers (contact code starting with I)', async () => {
      const external = buildInvoice({
        invoiceId: 'ext',
        recipientContactCode: 'P1',
      })
      const internal = buildInvoice({
        invoiceId: 'int',
        recipientContactCode: 'I1',
      })

      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [external, internal], errors: undefined },
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices.map((i) => i.invoiceId)).toEqual(['ext'])
      expect(result.skippedInvoices.map((i) => i.invoiceId)).toEqual(['int'])
    })

    it('collects errors and removes failing invoices from the export', async () => {
      const good = buildInvoice({ invoiceId: 'good' })
      const bad = buildInvoice({ invoiceId: 'bad' })

      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [good, bad], errors: undefined },
      })
      ;(enrichInvoiceWithAccounting as jest.Mock).mockImplementation(
        async (invoice: InvoiceWithAccounting) => {
          if (invoice.invoiceId === 'bad') throw new Error('enrich failed')
        }
      )

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices.map((i) => i.invoiceId)).toEqual(['good'])
      expect(result.errors).toEqual([
        { invoiceNumber: 'bad', error: 'enrich failed' },
      ])
    })

    it('applies counterpart customer accounts when a match is found', async () => {
      const invoice = buildInvoice()
      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [invoice], errors: undefined },
      })
      mockFindCounterPartCustomer.mockReturnValue({
        customerName: 'Test Tenant',
        counterPartCode: 'CP1',
        ledgerAccount: '1510',
        totalAccount: '2440',
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices[0]).toMatchObject({
        ledgerAccount: '1510',
        totalAccount: '2440',
        counterPartCode: 'CP1',
      })
    })

    it('falls back to default accounts when no counterpart matches', async () => {
      const invoice = buildInvoice()
      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [invoice], errors: undefined },
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices[0]).toMatchObject({
        ledgerAccount: '1530',
        totalAccount: '2970',
      })
    })
  })

  describe('createAccounting', () => {
    it('returns aggregate and ledger csv with headers', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
      })

      const result = await createAccounting([invoice])

      expect(result.aggregateAccountingCsv[0]).toContain('Voucher Type')
      expect(result.ledgerAccountingCsv[0]).toContain('Voucher Type')
      expect(result.aggregateAccountingCsv.length).toBeGreaterThan(1)
      expect(result.errors).toEqual([])
    })

    it('writes period start and number of periods to their own columns', async () => {
      mockGetPeriodInformationFromDateStrings.mockReturnValue({
        periodStart: '1',
        periods: '3',
      })
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
      })

      const result = await createAccounting([invoice])

      const header = result.aggregateAccountingCsv[0].split(';')
      const periodStartIndex = header.indexOf('Period Start')
      const periodsIndex = header.indexOf('No of Periods')
      const dataRows = result.aggregateAccountingCsv
        .slice(1)
        .map((row) => row.split(';'))

      expect(dataRows.length).toBeGreaterThan(0)
      dataRows.forEach((columns) => {
        expect(columns[periodStartIndex]).toBe('1')
        expect(columns[periodsIndex]).toBe('3')
      })
    })

    it('includes a round off row when roundoff is non-zero', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
        roundoff: 0.43,
      })

      await createAccounting([invoice])

      expect(mockGetRoundOffInformation).toHaveBeenCalled()
    })

    it('does not throw when the ledger and aggregate sums match', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
      })

      await expect(createAccounting([invoice], 1)).resolves.toMatchObject({
        errors: [],
      })
    })

    it('throws when the ledger and aggregate sums differ more than the accepted difference', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
        invoiceRows: [
          {
            amount: 900,
            totalAmount: 900,
            vat: 0,
            deduction: 0,
            account: '3012',
            costCode: '123',
            invoiceRowText: 'Hyra bostad',
          } as any,
        ],
      })

      await expect(createAccounting([invoice], 1)).rejects.toThrow(
        'exceeds the accepted difference of 1'
      )
    })

    it('allows a difference within the accepted difference (rounding errors)', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
        invoiceRows: [
          {
            amount: 999.99,
            totalAmount: 999.99,
            vat: 0,
            deduction: 0,
            account: '3012',
            costCode: '123',
            invoiceRowText: 'Hyra bostad',
          } as any,
        ],
      })

      await expect(createAccounting([invoice], 0.01)).resolves.toMatchObject({
        errors: [],
      })
    })

    it('throws at the default accepted difference when none is provided', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
        invoiceRows: [
          {
            amount: 5,
            totalAmount: 5,
            vat: 0,
            deduction: 0,
            account: '3012',
            costCode: '123',
            invoiceRowText: 'Hyra bostad',
          } as any,
        ],
      })

      await expect(createAccounting([invoice])).rejects.toThrow(
        'differ by 995, which exceeds the accepted difference of 1'
      )
    })
  })

  describe('createLedgerRows', () => {
    it('creates one ledger row per invoice plus a total row per chunk', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
      })

      const rows = await createLedgerRows([invoice])

      expect(rows).toHaveLength(2)
      expect(rows[0].account).toBe('1530')
      expect(rows[1].account).toBe('2970')
      expect(rows[1].amount).toBe(-1000)
    })
  })

  describe('createAggregatedTotalRow', () => {
    it('sums the negated total amounts of the aggregated rows', () => {
      const rows: AggregatedRow[] = [
        {
          amount: 0,
          totalAmount: -100,
          vat: 0,
          account: '3012',
          voucherDate: '2026-07-01',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          totalAccount: '2970',
        },
        {
          amount: 0,
          totalAmount: -50,
          vat: 0,
          account: '3013',
          voucherDate: '2026-07-01',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          totalAccount: '2970',
        },
      ]

      const totalRow = createAggregatedTotalRow(rows, 'V1')

      expect(totalRow.account).toBe('2970')
      expect(totalRow.amount).toBe(150)
      expect(totalRow.voucherNumber).toBe('V1')
    })
  })

  describe('exportRentalLosses', () => {
    it('throws when the company cannot be found', async () => {
      await expect(exportRentalLosses('999')).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('throws when the rental loss adapter returns an error', async () => {
      mockGetRentalLosses.mockResolvedValue({ ok: false, err: 'nope' })

      await expect(exportRentalLosses('001')).rejects.toThrow(
        'Could not retrieve rental loss information: nope'
      )
    })

    it('returns the rental losses, errors and objects without rent rows on success', async () => {
      const rentalLosses: RentalLoss[] = [{ rentalObject: 'RO1' } as RentalLoss]
      const errors = [{ rentalObject: 'RO2', error: 'fel' }]
      mockGetRentalLosses.mockResolvedValue({
        ok: true,
        data: {
          rentalLosses,
          errors,
          rentalObjectsWithoutRentRows: ['RO3'],
          checksumMismatches: [],
        },
      })

      const result = await exportRentalLosses('001')

      expect(result).toEqual({
        rentalLosses,
        errors,
        rentalObjectsWithoutRentRows: ['RO3'],
        checksumMismatches: [],
      })
    })
  })

  describe('handleRentalBlocks', () => {
    // Summing already-rounded öre amounts leaves float noise; compare at öre.
    const roundToOre = (value: number) => Math.round(value * 100) / 100

    const interval = {
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-31T00:00:00.000Z'),
    }

    const buildRentalLoss = (
      overrides: Partial<RentalLoss> = {}
    ): RentalLoss => ({
      rentalObject: 'RO1',
      month: '2026-07',
      days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
      uncontractedInterval: interval,
      rentalLossRows: [
        {
          amount: 3100,
          totalAmount: 3720,
          vat: 0.2,
          incomeAccount: 3012,
          costAccount: 6100,
        } as any,
      ],
      ...overrides,
    })

    const buildBlock = (
      overrides: Partial<RentalBlockWithAccounting> = {}
    ): RentalBlockWithAccounting => ({
      account: '7300',
      costCode: 'CC1',
      property: 'PROP1',
      projectCode: 'PROJ1',
      freeCode: 'FREE1',
      description: 'Block',
      fromDate: new Date('2026-07-01T00:00:00.000Z'),
      toDate: new Date('2026-07-31T00:00:00.000Z'),
      ...overrides,
    })

    beforeEach(() => {
      mockGetActiveRentalBlocksWithAccounting.mockReset()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([])
    })

    it('returns the rental loss unchanged when there are no active blocks', async () => {
      const rentalLoss = buildRentalLoss()

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result).toEqual(rentalLoss)
      expect(result.rentalLossRows[0].amount).toBe(3100)
    })

    it('replaces the cost side with the block when the block covers the whole period', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([buildBlock()])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(1)
      const row = result.rentalLossRows[0]
      expect(row.isBlock).toBe(true)
      expect(row.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(row.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // Amount is unchanged when the block covers the entire interval.
      expect(row.amount).toBe(3100)
      expect(row.totalAmount).toBe(3720)
      // Income side untouched.
      expect(row.incomeAccount).toBe(3012)
      // Cost side carries the block accounting.
      expect(row.costAccount).toBe(7300)
      expect(row.costProjectCode).toBe('PROJ1')
      expect(row.costProperty).toBe('PROP1')
      expect(row.costFreeCode).toBe('FREE1')
      expect(row.costCostCode).toBe('CC1')
    })

    describe('which rows get the block account', () => {
      const blockedRow = (overrides: Record<string, unknown>) =>
        buildRentalLoss({
          rentalLossRows: [
            {
              amount: 100,
              totalAmount: 100,
              vat: 0,
              incomeAccount: 3015,
              costAccount: 3085,
              ...overrides,
            } as any,
          ],
        })

      const costSide = async (
        overrides: Record<string, unknown>,
        block: Partial<RentalBlockWithAccounting>
      ) => {
        mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
          buildBlock(block),
        ])
        const [result] = await handleRentalBlocks([blockedRow(overrides)])
        const [row] = result.rentalLossRows
        return { costAccount: row.costAccount, costFreeCode: row.costFreeCode }
      }

      it('moves housing rent to a rental loss block account', async () => {
        expect(
          await costSide(
            { incomeAccount: 3011, costAccount: 3081 },
            { account: '3089', freeCode: '10607' }
          )
        ).toEqual({ costAccount: 3089, costFreeCode: '10607' })
      })

      it('keeps the article cost account for other rent, with the block free code', async () => {
        expect(
          await costSide({}, { account: '3086', freeCode: '10617' })
        ).toEqual({ costAccount: 3085, costFreeCode: '10617' })
      })

      it('moves parking rent to the parking block account', async () => {
        expect(
          await costSide({}, { account: '3087', freeCode: '10619' })
        ).toEqual({ costAccount: 3087, costFreeCode: '10619' })
      })

      it('gives rows keeping their account no other block accounting', async () => {
        mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
          buildBlock({ account: '1182', projectCode: '86450' }),
        ])

        const [result] = await handleRentalBlocks([
          blockedRow({
            incomeAccount: 2420,
            costAccount: 2420,
            costFreeCode: '10162',
            costProjectCode: undefined,
            costCostCode: '550',
            costProperty: 'KST',
          }),
        ])

        expect(result.rentalLossRows[0]).toMatchObject({
          costAccount: 2420,
          costFreeCode: '10162',
          costProjectCode: undefined,
          costCostCode: '550',
          costProperty: 'KST',
        })
      })

      it('moves any rent to a block account outside the rental loss accounts', async () => {
        expect(
          await costSide({}, { account: '1182', freeCode: '9806' })
        ).toEqual({ costAccount: 1182, costFreeCode: '9806' })
      })

      it('keeps the account and free code of rows booked on the same account', async () => {
        expect(
          await costSide(
            { incomeAccount: 2420, costAccount: 2420, costFreeCode: '10162' },
            { account: '3086', freeCode: '10610' }
          )
        ).toEqual({ costAccount: 2420, costFreeCode: '10162' })
      })

      it('gives rows booked on the same account the block free code if they have none', async () => {
        expect(
          await costSide(
            { incomeAccount: 2883, costAccount: 2883 },
            { account: '3081', freeCode: '10615' }
          )
        ).toEqual({ costAccount: 2883, costFreeCode: '10615' })
      })
    })

    it('splits a rent row valid during part of the interval within its own dates', async () => {
      // The row is valid 2026-07-11..2026-07-31 (21 days, 2100) and the block
      // covers 2026-07-01..2026-07-20, so the row splits at 2026-07-20.
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 2100,
            totalAmount: 2100,
            vat: 0,
            incomeAccount: 3012,
            costAccount: 6100,
            fromDate: new Date('2026-07-11T00:00:00.000Z'),
            toDate: new Date('2026-07-31T00:00:00.000Z'),
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({ toDate: new Date('2026-07-20T00:00:00.000Z') }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(
        result.rentalLossRows.map((row) => ({
          from: row.fromDate,
          to: row.toDate,
          amount: row.amount,
          isBlock: row.isBlock,
        }))
      ).toEqual([
        {
          from: new Date('2026-07-11T00:00:00.000Z'),
          to: new Date('2026-07-20T00:00:00.000Z'),
          amount: 1000,
          isBlock: true,
        },
        {
          from: new Date('2026-07-21T00:00:00.000Z'),
          to: new Date('2026-07-31T00:00:00.000Z'),
          amount: 1100,
          isBlock: undefined,
        },
      ])
    })

    it('prorates by days when the block partially overlaps the loss interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-11T00:00:00.000Z'),
          toDate: new Date('2026-07-31T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(2)

      const gapRow = result.rentalLossRows.find((r) => !r.isBlock)!
      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!

      // Loss gap: 2026-07-01..2026-07-10 = 10 days of 31 -> 3100 * 10/31 ≈ 1000
      expect(gapRow.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(gapRow.toDate).toEqual(new Date('2026-07-10T00:00:00.000Z'))
      expect(gapRow.amount).toBe(1000)
      expect(gapRow.costAccount).toBe(6100)
      expect(gapRow.isBlock).toBeUndefined()

      // Block portion: 2026-07-11..2026-07-31 = 21 days of 31 -> 3100 * 21/31 ≈ 2100
      expect(blockRow.fromDate).toEqual(new Date('2026-07-11T00:00:00.000Z'))
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      expect(blockRow.amount).toBe(2100)
      expect(blockRow.costAccount).toBe(7300)
    })

    it('splits into block+gap+block when the loss interval is only partially covered', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-05T00:00:00.000Z'),
          toDate: new Date('2026-07-10T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(3)
      // Block portion only spans 6 days.
      const blockRows = result.rentalLossRows.filter((r) => r.isBlock)
      expect(blockRows).toHaveLength(1)
      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-05T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-10T00:00:00.000Z'))
      // Gap before (4 days) and after (21 days) remain on the original account.
      const gapRows = result.rentalLossRows.filter((r) => !r.isBlock)
      expect(gapRows).toHaveLength(2)
      gapRows.sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())
      expect(gapRows[0].fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(gapRows[0].toDate).toEqual(new Date('2026-07-04T00:00:00.000Z'))
      expect(gapRows[1].fromDate).toEqual(new Date('2026-07-11T00:00:00.000Z'))
      expect(gapRows[1].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
    })

    it('makes the earliest block win on overlapping blocks', async () => {
      const rentalLoss = buildRentalLoss()
      const earlier = buildBlock({
        account: '7300',
        description: 'earlier',
        fromDate: new Date('2026-07-01T00:00:00.000Z'),
        toDate: new Date('2026-07-15T00:00:00.000Z'),
      })
      const later = buildBlock({
        account: '7400',
        description: 'later',
        fromDate: new Date('2026-07-10T00:00:00.000Z'),
        toDate: new Date('2026-07-31T00:00:00.000Z'),
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        earlier,
        later,
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      // Block 1 covers 1-15 (15 days, earliest wins on the 10-15 overlap)
      // Block 2 covers 16-31 (16 days) where earlier has released the range
      const blockRows = result.rentalLossRows.filter((r) => r.isBlock)
      expect(blockRows).toHaveLength(2)
      blockRows.sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())
      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-01T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-15T00:00:00.000Z'))
      expect(blockRows[0].costAccount).toBe(7300)
      expect(blockRows[1].fromDate).toEqual(
        new Date('2026-07-16T00:00:00.000Z')
      )
      expect(blockRows[1].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      expect(blockRows[1].costAccount).toBe(7400)
      // No gaps: the blocks jointly cover the whole interval.
      expect(result.rentalLossRows.filter((r) => !r.isBlock)).toHaveLength(0)
    })

    it('handles multiple distinct non-overlapping blocks with gaps between them', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          account: '7300',
          description: 'first',
          fromDate: new Date('2026-07-03T00:00:00.000Z'),
          toDate: new Date('2026-07-07T00:00:00.000Z'),
        }),
        buildBlock({
          account: '7400',
          description: 'second',
          fromDate: new Date('2026-07-20T00:00:00.000Z'),
          toDate: new Date('2026-07-25T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      // 2 block intervals (3-7, 20-25) + 3 gaps (1-2, 8-19, 26-31)
      const blockRows = result.rentalLossRows
        .filter((r) => r.isBlock)
        .sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())
      const gapRows = result.rentalLossRows
        .filter((r) => !r.isBlock)
        .sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())

      expect(blockRows).toHaveLength(2)
      expect(gapRows).toHaveLength(3)

      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-03T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-07T00:00:00.000Z'))
      expect(blockRows[0].costAccount).toBe(7300)
      expect(blockRows[1].fromDate).toEqual(
        new Date('2026-07-20T00:00:00.000Z')
      )
      expect(blockRows[1].toDate).toEqual(new Date('2026-07-25T00:00:00.000Z'))
      expect(blockRows[1].costAccount).toBe(7400)

      expect(gapRows[0].fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(gapRows[0].toDate).toEqual(new Date('2026-07-02T00:00:00.000Z'))
      expect(gapRows[1].fromDate).toEqual(new Date('2026-07-08T00:00:00.000Z'))
      expect(gapRows[1].toDate).toEqual(new Date('2026-07-19T00:00:00.000Z'))
      expect(gapRows[2].fromDate).toEqual(new Date('2026-07-26T00:00:00.000Z'))
      expect(gapRows[2].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // Gap rows keep the original cost account.
      expect(gapRows.every((r) => r.costAccount === 6100)).toBe(true)

      // The split covers the interval exactly once, with no lost days.
      const totalDays = result.rentalLossRows.reduce(
        (sum, r) =>
          sum +
          (r.toDate!.getTime() - r.fromDate!.getTime()) /
            (24 * 60 * 60 * 1000) +
          1,
        0
      )
      expect(totalDays).toBe(31)
    })

    it('assigns the rounding residual to the last split so the parts sum to the original', async () => {
      // 1000 over a 31-day interval does not divide evenly into any of the
      // splits below, so independent rounding would drift.
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 1000,
            totalAmount: 1250,
            vat: 0.25,
            incomeAccount: 3012,
            costAccount: 6100,
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          account: '7300',
          description: 'first',
          fromDate: new Date('2026-07-03T00:00:00.000Z'),
          toDate: new Date('2026-07-07T00:00:00.000Z'),
        }),
        buildBlock({
          account: '7400',
          description: 'second',
          fromDate: new Date('2026-07-20T00:00:00.000Z'),
          toDate: new Date('2026-07-25T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(5)
      const sum = result.rentalLossRows.reduce((s, r) => s + r.amount, 0)
      const totalSum = result.rentalLossRows.reduce(
        (s, r) => s + r.totalAmount,
        0
      )
      expect(roundToOre(sum)).toBe(1000)
      expect(roundToOre(totalSum)).toBe(1250)

      // The residual lands on the chronologically last row.
      const last = result.rentalLossRows[result.rentalLossRows.length - 1]
      expect(last.fromDate).toEqual(new Date('2026-07-26T00:00:00.000Z'))
      expect(last.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
    })

    it('keeps each row balanced independently when there are several rows', async () => {
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 1000,
            totalAmount: 1250,
            vat: 0.25,
            incomeAccount: 3012,
            costAccount: 6100,
          } as any,
          {
            amount: 777,
            totalAmount: 971.25,
            vat: 0.25,
            incomeAccount: 3013,
            costAccount: 6200,
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-03T00:00:00.000Z'),
          toDate: new Date('2026-07-07T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const byIncomeAccount = (account: number) =>
        result.rentalLossRows.filter((r) => r.incomeAccount === account)

      expect(
        roundToOre(byIncomeAccount(3012).reduce((s, r) => s + r.amount, 0))
      ).toBe(1000)
      expect(
        roundToOre(byIncomeAccount(3013).reduce((s, r) => s + r.amount, 0))
      ).toBe(777)
      expect(
        roundToOre(byIncomeAccount(3013).reduce((s, r) => s + r.totalAmount, 0))
      ).toBe(971.25)
    })

    it('truncates a block that starts before the uncontracted interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-06-15T00:00:00.000Z'),
          toDate: new Date('2026-07-10T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!
      // Clamped to the loss start, not the block start.
      expect(blockRow.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(blockRow.toDate).toEqual(new Date('2026-07-10T00:00:00.000Z'))
      // 10 of 31 days, not the block's own 26 days.
      expect(blockRow.amount).toBe(1000)
    })

    it('truncates a block that ends after the uncontracted interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-21T00:00:00.000Z'),
          toDate: new Date('2026-09-30T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!
      expect(blockRow.fromDate).toEqual(new Date('2026-07-21T00:00:00.000Z'))
      // Clamped to the loss end, not the block end.
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // 11 of 31 days.
      expect(blockRow.amount).toBe(1100)
    })

    it('truncates a block that engulfs the uncontracted interval on both sides', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-05-01T00:00:00.000Z'),
          toDate: new Date('2026-12-31T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      // One row covering exactly the loss interval, no gaps.
      expect(result.rentalLossRows).toHaveLength(1)
      const blockRow = result.rentalLossRows[0]
      expect(blockRow.isBlock).toBe(true)
      expect(blockRow.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // The full loss amount, never scaled up beyond it.
      expect(blockRow.amount).toBe(3100)
      expect(blockRow.totalAmount).toBe(3720)
    })

    it('truncates each of several blocks that spill outside the uncontracted interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          account: '7300',
          description: 'before',
          fromDate: new Date('2026-06-20T00:00:00.000Z'),
          toDate: new Date('2026-07-05T00:00:00.000Z'),
        }),
        buildBlock({
          account: '7400',
          description: 'after',
          fromDate: new Date('2026-07-25T00:00:00.000Z'),
          toDate: new Date('2026-08-15T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const blockRows = result.rentalLossRows.filter((r) => r.isBlock)
      expect(blockRows).toHaveLength(2)
      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-01T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-05T00:00:00.000Z'))
      expect(blockRows[1].fromDate).toEqual(
        new Date('2026-07-25T00:00:00.000Z')
      )
      expect(blockRows[1].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))

      // 5 + 19 (gap 6-24) + 7 = 31 days, all inside the loss interval.
      const totalDays = result.rentalLossRows.reduce(
        (sum, r) =>
          sum +
          (r.toDate!.getTime() - r.fromDate!.getTime()) /
            (24 * 60 * 60 * 1000) +
          1,
        0
      )
      expect(totalDays).toBe(31)
      expect(
        roundToOre(result.rentalLossRows.reduce((s, r) => s + r.amount, 0))
      ).toBe(3100)
    })

    it('ignores blocks entirely outside the loss interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-06-01T00:00:00.000Z'),
          toDate: new Date('2026-06-30T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(1)
      expect(result.rentalLossRows[0].isBlock).toBeUndefined()
      expect(result.rentalLossRows[0].amount).toBe(3100)
    })

    it('treats an open-ended block (null toDate) as covering through the loss interval end', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-11T00:00:00.000Z'),
          toDate: null,
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(2)
      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!
      expect(blockRow.fromDate).toEqual(new Date('2026-07-11T00:00:00.000Z'))
      // Null toDate is capped to the loss interval end.
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      expect(blockRow.amount).toBe(2100)
    })

    it('splits each rental loss row independently for multiple rows on a rental object', async () => {
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 1000,
            totalAmount: 1200,
            vat: 0.2,
            incomeAccount: 3012,
            costAccount: 6100,
          } as any,
          {
            amount: 2000,
            totalAmount: 2400,
            vat: 0.2,
            incomeAccount: 3013,
            costAccount: 6200,
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-11T00:00:00.000Z'),
          toDate: new Date('2026-07-31T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(4)
      expect(result.rentalLossRows.filter((r) => r.isBlock)).toHaveLength(2)
      expect(result.rentalLossRows.filter((r) => !r.isBlock)).toHaveLength(2)
    })
  })

  describe('enrichRentalLossesWithAccounting', () => {
    const buildRentalLoss = (
      overrides: Partial<RentalLoss> = {},
      rowOverrides: Record<string, unknown> = {}
    ): RentalLoss => ({
      rentalObject: 'RO1',
      month: '2026-07',
      days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
      uncontractedInterval: {
        from: new Date('2026-07-01T00:00:00.000Z'),
        to: new Date('2026-07-31T00:00:00.000Z'),
      },
      rentalLossRows: [
        {
          amount: 3100,
          totalAmount: 3720,
          vat: 0.2,
          incomeAccount: 3012,
          costAccount: 6100,
          ...rowOverrides,
        } as any,
      ],
      ...overrides,
    })

    beforeEach(() => {
      mockGetRentalSpecificRules.mockReset()
    })

    it('fills missing cost center and property on both income and cost side', async () => {
      mockGetRentalSpecificRules.mockResolvedValue({
        RO1: { costCode: 'CC1', property: 'PROP1' },
      })

      const { rentalLosses, errors } = await enrichRentalLossesWithAccounting([
        buildRentalLoss(),
      ])

      expect(errors).toEqual([])
      expect(mockGetRentalSpecificRules).toHaveBeenCalledWith(['RO1'], '2026')
      const row = rentalLosses[0].rentalLossRows[0]
      expect(row.incomeCostCode).toBe('CC1')
      expect(row.incomeProperty).toBe('PROP1')
      expect(row.costCostCode).toBe('CC1')
      expect(row.costProperty).toBe('PROP1')
    })

    it('keeps values already set by the article or a rental block', async () => {
      mockGetRentalSpecificRules.mockResolvedValue({
        RO1: { costCode: 'CC1', property: 'PROP1' },
      })

      const { rentalLosses } = await enrichRentalLossesWithAccounting([
        buildRentalLoss(
          {},
          {
            incomeCostCode: 'ARTCC',
            costCostCode: 'BLOCKCC',
            costProperty: 'BLOCKPROP',
          }
        ),
      ])

      const row = rentalLosses[0].rentalLossRows[0]
      expect(row.incomeCostCode).toBe('ARTCC')
      expect(row.incomeProperty).toBe('PROP1')
      expect(row.costCostCode).toBe('BLOCKCC')
      expect(row.costProperty).toBe('BLOCKPROP')
    })

    it('looks up rules per year and deduplicates rental objects', async () => {
      mockGetRentalSpecificRules.mockImplementation(
        async (rentalIds: string[]) =>
          Object.fromEntries(
            rentalIds.map((id) => [id, { costCode: 'CC', property: 'P' }])
          )
      )

      await enrichRentalLossesWithAccounting([
        buildRentalLoss({ rentalObject: 'RO1', month: '2026-12' }),
        buildRentalLoss({ rentalObject: 'RO1', month: '2026-12' }),
        buildRentalLoss({ rentalObject: 'RO2', month: '2027-01' }),
      ])

      expect(mockGetRentalSpecificRules).toHaveBeenCalledTimes(2)
      expect(mockGetRentalSpecificRules).toHaveBeenCalledWith(['RO1'], '2026')
      expect(mockGetRentalSpecificRules).toHaveBeenCalledWith(['RO2'], '2027')
    })

    it('keeps rental losses without rules unchanged and reports an error', async () => {
      mockGetRentalSpecificRules.mockResolvedValue({
        RO1: { costCode: 'CC1', property: 'PROP1' },
      })
      const withoutRules = buildRentalLoss({ rentalObject: 'RO2' })

      const { rentalLosses, errors } = await enrichRentalLossesWithAccounting([
        buildRentalLoss({ rentalObject: 'RO1' }),
        withoutRules,
      ])

      expect(rentalLosses.map((r) => r.rentalObject)).toEqual(['RO1', 'RO2'])
      expect(rentalLosses[1]).toEqual(withoutRules)
      expect(errors).toEqual([
        {
          rentalObject: 'RO2',
          error: expect.stringContaining('RO2'),
        },
      ])
    })
  })

  describe('createRentalLossAccounting', () => {
    it('produces an income and cost row per rental loss row', async () => {
      const rentalLosses: RentalLoss[] = [
        {
          rentalObject: 'RO1',
          month: '2026-07',
          days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
          uncontractedInterval: {
            from: new Date('2026-07-01T00:00:00.000Z'),
            to: new Date('2026-07-31T00:00:00.000Z'),
          },
          rentalLossRows: [
            {
              amount: 100,
              totalAmount: 100,
              vat: 0,
              incomeAccount: 3012,
              costAccount: 6100,
            } as any,
          ],
        },
      ]

      const result = await createRentalLossAccounting(rentalLosses)

      // header + income row + cost row
      expect(result.aggregateRentalLossAccountingCsv).toHaveLength(3)
      expect(result.errors).toEqual([])
      // Rental loss reverses income: income account debited (negative),
      // cost account credited (positive).
      const [, incomeRow, costRow] = result.aggregateRentalLossAccountingCsv
      expect(incomeRow.split(';')[3]).toBe('3012')
      expect(incomeRow.endsWith(';-100')).toBe(true)
      expect(costRow.split(';')[3]).toBe('6100')
      expect(costRow.endsWith(';100')).toBe(true)
    })

    const lossWithRows = (rows: Record<string, unknown>[]): RentalLoss => ({
      rentalObject: 'RO1',
      month: '2026-07',
      days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
      uncontractedInterval: {
        from: new Date('2026-07-01T00:00:00.000Z'),
        to: new Date('2026-07-31T00:00:00.000Z'),
      },
      rentalLossRows: rows.map(
        (row) =>
          ({
            amount: 100,
            totalAmount: 100,
            vat: 0,
            incomeAccount: 3015,
            costAccount: 3085,
            ...row,
          }) as any
      ),
    })

    const parseCsv = (csv: string[]) =>
      csv.slice(1).map((line) => {
        const fields = line.split(';')
        return {
          voucherType: fields[0],
          voucherNumber: fields[1],
          account: fields[3],
          amount: Number(fields[fields.length - 1]),
        }
      })

    it('uses voucher type GL', async () => {
      const result = await createRentalLossAccounting([lossWithRows([{}])])

      expect(
        parseCsv(result.aggregateRentalLossAccountingCsv).map(
          (row) => row.voucherType
        )
      ).toEqual(['GL', 'GL'])
    })

    it('keeps every voucher balanced when a voucher is split', async () => {
      // 251 rows give 502 csv rows, more than one voucher holds
      const rows = Array.from({ length: 251 }, (_, i) => ({ amount: i + 1 }))

      const result = await createRentalLossAccounting([lossWithRows(rows)])

      const balances: Record<string, number> = {}
      parseCsv(result.aggregateRentalLossAccountingCsv).forEach((row) => {
        balances[row.voucherNumber] =
          (balances[row.voucherNumber] ?? 0) + row.amount
      })
      expect(Object.keys(balances).length).toBeGreaterThan(1)
      Object.values(balances).forEach((balance) =>
        expect(balance).toBeCloseTo(0, 2)
      )
    })

    it('leaves out rows on excluded accounts', async () => {
      const result = await createRentalLossAccounting([
        lossWithRows([{}, { incomeAccount: 2425, costAccount: 2425 }]),
      ])

      expect(
        parseCsv(result.aggregateRentalLossAccountingCsv).map(
          (row) => row.account
        )
      ).toEqual(['3015', '3085'])
      expect(result.errors).toEqual([])
    })

    it('leaves out rows without a valid cost account and reports them', async () => {
      const rentalLosses: RentalLoss[] = [
        {
          rentalObject: 'RO1',
          month: '2026-07',
          days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
          uncontractedInterval: {
            from: new Date('2026-07-01T00:00:00.000Z'),
            to: new Date('2026-07-31T00:00:00.000Z'),
          },
          rentalLossRows: [
            {
              amount: 100,
              totalAmount: 100,
              vat: 0,
              rentArticleName: 'HYRA',
              incomeAccount: 3012,
              costAccount: 6100,
            } as any,
            {
              amount: 50,
              totalAmount: 50,
              vat: 0,
              rentArticleName: 'HYRA',
              incomeAccount: 3012,
              costAccount: NaN,
              isBlock: true,
            } as any,
          ],
        },
      ]

      const result = await createRentalLossAccounting(rentalLosses)

      // header + income row + cost row for the valid row only
      expect(result.aggregateRentalLossAccountingCsv).toHaveLength(3)
      expect(result.errors).toEqual([
        {
          rentalObject: 'RO1',
          error: 'Raden för HYRA saknar kostnadskonto (spärr)',
        },
      ])
    })
  })

  describe('uploadCsvFiles', () => {
    it('throws when the company cannot be found', async () => {
      await expect(uploadCsvFiles('999', [], [])).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('uploads both the aggregate and ledger files', async () => {
      await uploadCsvFiles('001', ['a'], ['b'])

      expect(mockUploadFile).toHaveBeenCalledTimes(2)
      expect(mockUploadFile.mock.calls[0][0]).toContain('aggregated.gl.csv')
      expect(mockUploadFile.mock.calls[1][0]).toContain('ledger.gl.csv')
    })
  })

  describe('uploadRentalLossCsvFile', () => {
    it('throws when the company cannot be found', async () => {
      await expect(uploadRentalLossCsvFile('999', [])).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('uploads the rental loss file', async () => {
      await uploadRentalLossCsvFile('001', ['a'])

      expect(mockUploadFile).toHaveBeenCalledTimes(1)
      expect(mockUploadFile.mock.calls[0][0]).toContain('rental-loss.gl.csv')
    })
  })
})
