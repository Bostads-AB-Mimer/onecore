import { XledgerCustomer } from '@src/services/common/adapters/xledger-adapter'

// Mock data factory
export const createMockXledgerCustomer = (
  overrides: Partial<XledgerCustomer> = {}
): XledgerCustomer => ({
  contactCode: 'CONTACT001',
  fullName: 'John Doe',
  nationalRegistrationNumber: '19900101-1234',
  address: {
    street: 'Test Street 1',
    postalCode: '12345',
    city: 'Test City',
  },
  phoneNumber: '0701234567',
  ...overrides,
})

// Mock functions
export const getCustomers = jest.fn()

// Setup default mock implementations
export const setupDefaultMocks = () => {
  getCustomers.mockResolvedValue([])
}

export const resetMocks = () => {
  getCustomers.mockReset()
}
