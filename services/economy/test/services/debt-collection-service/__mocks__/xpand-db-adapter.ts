import { Contact } from '@onecore/types'
import {
  RentInvoice,
  RentalProperty,
  RentInvoiceRow,
} from '@src/services/common/types'

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
  ...overrides,
})

export const createMockRentInvoice = (
  overrides: Partial<RentInvoice> = {}
): RentInvoice => ({
  invoiceNumber: 'INV001',
  reference: 'RENTAL001/2023',
  roundoff: 0,
  fromDate: new Date('2023-01-01'),
  toDate: new Date('2023-01-31'),
  invoiceDate: new Date('2023-01-01'),
  expiryDate: new Date('2023-01-31'),
  lastDebitDate: undefined,
  careOf: undefined,
  ...overrides,
})

export const createMockRentalProperty = (
  overrides: Partial<RentalProperty> = {}
): RentalProperty => ({
  rentalId: 'REN-TAL-00-1001',
  code: 'R001',
  address: 'Test Property Address 1',
  postalCode: '12345',
  city: 'Test City',
  type: 'Apartment',
  areaSize: 50.5,
  rentalPropertyType: 'Residence' as const,
  ...overrides,
})

export const createMockRentInvoiceRow = (
  overrides: Partial<RentInvoiceRow> = {}
): RentInvoiceRow => ({
  invoiceNumber: 'INV001',
  type: 'Rent' as const,
  text: 'Rent payment',
  rentType: 'Hyra bostad',
  amount: 5000,
  reduction: 0,
  vat: 0,
  printGroup: 'N',
  code: '',
  rowType: 0,
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
      text: 'REN-TAL-00-1001/01',
      printGroup: null,
    }),
    // Rent row
    createMockRentInvoiceRow({
      printGroup: 'N',
      text: 'Hyra bostad',
      rentType: 'Hyra bostad',
      type: 'Rent',
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
