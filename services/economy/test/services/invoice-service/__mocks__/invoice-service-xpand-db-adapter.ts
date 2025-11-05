// Mock functions
export const getRoundOffInformation = jest.fn()
export const enrichInvoiceRows = jest.fn()
export const addAccountInformation = jest.fn()

// Setup default mock implementations
export const setupDefaultMocks = () => {
  getRoundOffInformation.mockResolvedValue({
    account: '3999',
    costCode: '123',
  })
  enrichInvoiceRows.mockResolvedValue({
    rows: [],
    errors: [],
  })
  addAccountInformation.mockResolvedValue({
    rows: [],
  })
}

// Reset all mocks
export const resetMocks = () => {
  getRoundOffInformation.mockReset()
  enrichInvoiceRows.mockReset()
  addAccountInformation.mockReset()
}
