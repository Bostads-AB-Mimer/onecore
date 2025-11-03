import { CounterPartCustomer } from '../../../../common/types'

// Mock data factories
export const createMockCounterPartCustomer = (
  overrides: Partial<CounterPartCustomer> = {}
): CounterPartCustomer => {
  return {
    customerName: 'Västerås kommunala bolag AB',
    counterPartCode: '123456',
    ledgerAccount: '2899',
    totalAccount: '1599',
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
  addAccountInformation.mockResolvedValue([])
}

// Reset all mocks
export const resetMocks = () => {
  getCounterPartCustomers.mockReset()
  saveInvoiceRows.mockReset()
  addAccountInformation.mockReset()
}
