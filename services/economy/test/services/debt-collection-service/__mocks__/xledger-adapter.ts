import { XledgerContact } from '@src/services/common/adapters/xledger-adapter'

// Mock data factory
export const createMockXledgerContact = (
  overrides: Partial<XledgerContact> = {}
): XledgerContact => ({
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
export const getContacts = jest.fn()

// Setup default mock implementations
export const setupDefaultMocks = () => {
  getContacts.mockResolvedValue([])
}

export const resetMocks = () => {
  getContacts.mockReset()
}
