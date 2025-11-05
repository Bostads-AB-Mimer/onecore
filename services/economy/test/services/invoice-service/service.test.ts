import { processInvoiceRows } from '@src/services/invoice-service/service'

const mockInvoiceDataRows = [
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
  addAccountInformation,
  saveInvoiceRows,
  resetMocks,
  setupDefaultMocks as setupDefaultInvoiceDbMocks,
} from './__mocks__/invoice-data-db-adapter'

import {
  getRoundOffInformation,
  setupDefaultMocks as setupDefaultXpandDbMocks,
} from './__mocks__/invoice-service-xpand-db-adapter'

describe('Rental Invoice Service', () => {
  beforeEach(() => {
    setupDefaultInvoiceDbMocks()
    setupDefaultXpandDbMocks()
    console.log('mocks setup')
  })

  afterEach(() => {
    resetMocks()
    jest.clearAllMocks()
  })

  describe('processInvoiceRows', () => {
    it('Should call adapter functions', async () => {
      await processInvoiceRows(mockInvoiceDataRows, '1337')

      expect(getCounterPartCustomers).toHaveBeenCalled()
      expect(getRoundOffInformation).toHaveBeenCalled()
      expect(addAccountInformation).toHaveBeenCalled()
      expect(saveInvoiceRows).toHaveBeenCalled()
    })
  })
})
