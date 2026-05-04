import {
  getBatchContactsCsv,
  getBatchLedgerRowsCsv,
  processInvoiceRows,
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
})
