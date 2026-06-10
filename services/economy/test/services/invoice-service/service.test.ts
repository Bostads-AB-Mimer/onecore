import {
  processInvoiceRows,
  getInvoiceDetails,
  getBatchContactsCsv,
  getBatchLedgerRowsCsv,
  getAutogiroConsent,
} from '@src/services/invoice-service/service'

let mockInvoiceDataRows = [
  {
    rentArticle: 'HYRAB',
    invoiceRowText: 'Hyra bostad',
    totalAmount: 999.57,
    amount: 999.57,
    vat: 0,
    deduction: 0,
    company: '001',
    invoiceDate: '20250515',
    invoiceDueDate: '20250531',
    invoiceNumber: '55123456',
    contactCode: 'P999999',
    tenantName: 'Test A Ren',
    account: '3012',
    projectCode: '12345',
    freeCode: '54321',
    roundoff: 0.43,
    fromDate: '20250601',
    toDate: '20250630',
    printGroup: 'A',
    contractCode: '000-000-000/01',
    printGroupLabel: 'Hyra bostad',
    invoiceTotalAmount: 1000,
    rowType: 1,
  },
]

// Mock database adapters
jest.mock(
  '@src/services/invoice-service/adapters/invoice-data-db-adapter',
  () => require('./__mocks__/invoice-data-db-adapter')
)
jest.mock('@src/services/invoice-service/adapters/xpand-db-adapter', () =>
  require('./__mocks__/invoice-service-xpand-db-adapter')
)

// Mock the additional adapters used by getInvoiceDetails
jest.mock('@src/services/common/adapters/xledger-adapter', () => ({
  ...jest.requireActual('@src/services/common/adapters/xledger-adapter'),
  getInvoiceByInvoiceNumber: jest.fn(),
  uploadFile: jest.fn(),
  createCustomerLedgerRow: jest.fn(),
  transformAggregatedInvoiceRow: jest.fn(),
}))

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  getInvoiceByOcr: jest.fn(),
  getInvoiceArticle: jest.fn(),
  getAutogiroConsentByNationalRegistrationNumber: jest.fn(),
}))

import {
  getCounterPartCustomers,
  saveInvoiceRows,
  resetMocks as resetInvoiceDbMocks,
  addAccountInformation,
  setupDefaultMocks as setupDefaultInvoiceDbMocks,
  getAllInvoiceRows,
  getContacts,
} from './__mocks__/invoice-data-db-adapter'

import {
  getRoundOffInformation,
  resetMocks as resetXpandDbMocks,
  setupDefaultMocks as setupDefaultXpandDbMocks,
} from './__mocks__/invoice-service-xpand-db-adapter'

// Import the actual modules to get proper typing
import { getInvoiceByInvoiceNumber } from '@src/services/common/adapters/xledger-adapter'
import {
  getInvoiceByOcr,
  getInvoiceArticle,
  getAutogiroConsentByNationalRegistrationNumber,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { TenfastAutogiroConsentFactory } from '@test/factories'

// Assign the mocked functions
const mockGetInvoiceByInvoiceNumber = getInvoiceByInvoiceNumber as jest.Mock
const mockGetInvoiceByOcr = getInvoiceByOcr as jest.Mock
const mockGetInvoiceArticle = getInvoiceArticle as jest.Mock
const mockGetAutogiroConsent =
  getAutogiroConsentByNationalRegistrationNumber as jest.Mock

describe('Rental Invoice Service', () => {
  describe('processInvoiceRows', () => {
    beforeEach(() => {
      setupDefaultInvoiceDbMocks()
      setupDefaultXpandDbMocks()
      mockInvoiceDataRows = [
        {
          rentArticle: 'HYRAB',
          invoiceRowText: 'Hyra bostad',
          totalAmount: 999.57,
          amount: 999.57,
          vat: 0,
          deduction: 0,
          company: '001',
          invoiceDate: '20250515',
          invoiceDueDate: '20250531',
          invoiceNumber: '55123456',
          contactCode: 'P999999',
          tenantName: 'Test A Ren',
          account: '3012',
          projectCode: '12345',
          freeCode: '54321',
          roundoff: 0.43,
          fromDate: '20250601',
          toDate: '20250630',
          printGroup: 'A',
          contractCode: '000-000-000/01',
          printGroupLabel: 'Hyra bostad',
          invoiceTotalAmount: 1000,
          rowType: 1,
        },
      ]
    })

    afterEach(() => {
      resetInvoiceDbMocks()
      resetXpandDbMocks()
      jest.clearAllMocks()
    })

    it('Should call adapter functions', async () => {
      await processInvoiceRows(mockInvoiceDataRows, '1337')

      expect(getCounterPartCustomers).toHaveBeenCalled()
      expect(getRoundOffInformation).toHaveBeenCalled()
      expect(addAccountInformation).toHaveBeenCalled()
      expect(saveInvoiceRows).toHaveBeenCalled()
    })

    it('Should add ledger and total accounts to rows', async () => {
      await processInvoiceRows(mockInvoiceDataRows, '1337')
      expect(saveInvoiceRows).toHaveBeenCalledWith(
        [
          {
            ledgerAccount: '1599',
            totalAccount: '2899',
            ...mockInvoiceDataRows[0],
          },
          {
            account: '3999',
            amount: mockInvoiceDataRows[0].roundoff,
            costCode: '123',
            counterPart: '123456',
            contactCode: mockInvoiceDataRows[0].contactCode,
            contractCode: mockInvoiceDataRows[0].contractCode,
            fromDate: mockInvoiceDataRows[0].fromDate,
            invoiceDate: mockInvoiceDataRows[0].invoiceDate,
            invoiceNumber: mockInvoiceDataRows[0].invoiceNumber,
            invoiceRowText: 'Öresutjämning',
            invoiceTotalAmount: mockInvoiceDataRows[0].invoiceTotalAmount,
            ledgerAccount: '1599',
            totalAccount: '2899',
            tenantName: mockInvoiceDataRows[0].tenantName,
            toDate: mockInvoiceDataRows[0].toDate,
            totalAmount: mockInvoiceDataRows[0].roundoff,
          },
        ],
        '1337'
      )
    })
  })

  describe('getInvoiceDetails', () => {
    const mockXledgerInvoice = {
      invoiceId: 'test-invoice-id',
      invoiceNumber: '55123456',
      customerCode: 'P999999',
      amount: 1000,
      invoiceRows: [],
    }

    const mockTenfastInvoiceResult = {
      ok: true,
      data: {
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
    }

    const mockArticles = [
      {
        _id: 'HYRAB',
        label: 'Hyra bostad',
      },
      {
        _id: 'PARK',
        label: 'Parkering',
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
        ...mockXledgerInvoice,
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

      await expect(getInvoiceDetails('55123456')).rejects.toEqual(
        mockTenfastError
      )

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
      expect(result).toEqual(mockXledgerInvoice)
    })

    it('should handle invoice rows without rent articles', async () => {
      const mockTenfastResultWithoutArticles = {
        ok: true,
        data: {
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
        ...mockXledgerInvoice,
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
        ...mockXledgerInvoice,
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
        ...mockXledgerInvoice,
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

  describe('getBatchContactsCsv', () => {
    beforeEach(() => {
      setupDefaultInvoiceDbMocks()
      setupDefaultXpandDbMocks()
    })

    afterEach(() => {
      resetInvoiceDbMocks()
      resetXpandDbMocks()
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

  describe('getBatchLedgerRowsCsv', () => {
    beforeEach(() => {
      setupDefaultInvoiceDbMocks()
      setupDefaultXpandDbMocks()
    })

    afterEach(() => {
      resetInvoiceDbMocks()
      resetXpandDbMocks()
      jest.clearAllMocks()
    })

    it('returns null when the batch has no invoice rows', async () => {
      getAllInvoiceRows.mockResolvedValueOnce([])

      const result = await getBatchLedgerRowsCsv('1337')

      expect(result).toBeNull()
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

      await expect(getAutogiroConsent('198001011234')).rejects.toEqual(
        'API error'
      )
    })
  })
})
