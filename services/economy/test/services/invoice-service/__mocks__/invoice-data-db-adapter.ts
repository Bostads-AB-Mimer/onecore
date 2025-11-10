import { CounterPartCustomer, InvoiceDataRow } from '@src/common/types'

// Mock data factories
export const createMockCounterPartCustomer = (
  overrides: Partial<CounterPartCustomer> = {}
): CounterPartCustomer => {
  return {
    customerName: 'Västerås kommunala bolag AB',
    counterPartCode: '123456',
    ledgerAccount: '1599',
    totalAccount: '2899',
    ...overrides,
  }
}

// Mock functions
export const getCounterPartCustomers = jest.fn()
export const saveInvoiceRows = jest.fn()
export const addAccountInformation = jest.fn()

// Setup default mock implementations
export const setupDefaultMocks = () => {
  getCounterPartCustomers.mockResolvedValue({
    customers: [createMockCounterPartCustomer()],
    find: () => createMockCounterPartCustomer(),
  })
  saveInvoiceRows.mockResolvedValue(null)
  addAccountInformation.mockImplementation((rows: InvoiceDataRow[]) => {
    const newRows = rows.map((row) => {
      return {
        ledgerAccount: '1599',
        totalAccount: '2899',
        ...row,
      }
    })
    return Promise.resolve(newRows)
  })
}

// Reset all mocks
export const resetMocks = () => {
  getCounterPartCustomers.mockReset()
  saveInvoiceRows.mockReset()
  addAccountInformation.mockReset()
}
