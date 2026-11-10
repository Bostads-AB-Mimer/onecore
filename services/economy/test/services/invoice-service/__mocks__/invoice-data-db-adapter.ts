// Mock functions
export const getContacts = jest.fn()

// Setup default mock implementations
export const setupDefaultMocks = () => {
  getContacts.mockResolvedValue([])
}

// Reset all mocks
export const resetMocks = () => {
  getContacts.mockReset()
}
