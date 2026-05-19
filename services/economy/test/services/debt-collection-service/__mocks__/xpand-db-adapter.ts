import {
  Contact,
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  PaymentStatus,
  RentalProperty,
} from '@onecore/types'

// Mock data factories
export const createMockContact = (
  overrides: Partial<Contact> = {}
): Contact => ({
  contactCode: 'CONTACT001',
  contactKey: 'KEY001',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  nationalRegistrationNumber: '19900101-1234',
  birthDate: new Date('1990-01-01'),
  address: {
    street: 'Test Street 1',
    number: '1',
    postalCode: '12345',
    city: 'Test City',
  },
  phoneNumbers: [
    { phoneNumber: '0701234567', type: 'mobile', isMainNumber: true },
  ],
  emailAddress: 'john.doe@example.com',
  isTenant: true,
  protectedIdentity: false,
  deceased: false,
  emigrated: false,
  noAdvertising: false,
  ...overrides,
})

export const createMockRentInvoice = (
  overrides: Partial<Invoice> = {}
): Invoice => ({
  invoiceId: 'INV001',
  leaseIds: [],
  amount: 5000,
  reference: 'RENTAL001/2023',
  fromDate: new Date('2023-01-01'),
  toDate: new Date('2023-01-31'),
  invoiceDate: new Date('2023-01-01'),
  expirationDate: new Date('2023-01-31'),
  debitStatus: 0,
  paymentStatus: PaymentStatus.Unpaid,
  transactionType: InvoiceTransactionType.Rent,
  transactionTypeName: 'Hyra',
  type: 'Regular',
  source: 'legacy',
  invoiceRows: [],
  credit: null,
  ...overrides,
})

export const createMockRentalProperty = (
  overrides: Partial<RentalProperty> = {}
): RentalProperty => ({
  rentalPropertyId: 'REN-TAL-00-1001',
  apartmentNumber: 1001,
  size: 50.5,
  type: 'Apartment',
  address: undefined,
  rentalPropertyType: 'Residence',
  additionsIncludedInRent: '',
  otherInfo: undefined,
  roomTypes: undefined,
  lastUpdated: undefined,
  ...overrides,
})

export const createMockRentInvoiceRow = (
  overrides: Partial<InvoiceRow> = {}
): InvoiceRow => ({
  invoiceNumber: 'INV001',
  invoiceRowText: 'Rent payment',
  amount: 5000,
  deduction: 0,
  vat: 0,
  printGroup: 'N',
  rowType: 0,
  fromDate: '2023-01-01',
  invoiceDate: '2023-01-01',
  invoiceDueDate: '2023-01-31',
  rentArticle: null,
  roundoff: 0,
  toDate: '2023-01-31',
  totalAmount: 5000,
  ...overrides,
})

// Mock functions
export const getContacts = jest.fn()
export const getInvoices = jest.fn()
export const getRentalProperties = jest.fn()
export const getInvoiceRows = jest.fn()

// Setup default mock implementations
export const setupDefaultMocks = () => {
  getContacts.mockResolvedValue([createMockContact()])
  getInvoices.mockResolvedValue([createMockRentInvoice()])
  getRentalProperties.mockResolvedValue([createMockRentalProperty()])
  getInvoiceRows.mockResolvedValue([
    // Header row with lease ID
    createMockRentInvoiceRow({
      rowType: 3,
      invoiceRowText: 'REN-TAL-00-1001/01',
      printGroup: null,
    }),
    // Rent row
    createMockRentInvoiceRow({
      printGroup: 'N',
      invoiceRowText: 'Hyra bostad',
    }),
  ])
}

// Reset all mocks
export const resetMocks = () => {
  getContacts.mockReset()
  getInvoices.mockReset()
  getRentalProperties.mockReset()
  getInvoiceRows.mockReset()
}
