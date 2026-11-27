import { RentalProperty, RentInvoiceRow } from '@onecore/types'

import { InvoiceDeliveryMethod, XpandContact } from '@src/common/types'
import { RentInvoice } from '@src/services/common/types'

export const createMockXpandContact = (
  overrides: Partial<XpandContact> = {}
): XpandContact => ({
  contactCode: 'XPAND001',
  contactKey: 'XKEY001',
  firstName: 'Jane',
  lastName: 'Doe',
  fullName: 'Jane Doe',
  nationalRegistrationNumber: '900101-1234',
  birthDate: new Date('1990-01-01'),
  address: {
    street: 'Xpand Street 1',
    number: '',
    postalCode: '54321',
    city: 'Xpand City',
  },
  phoneNumbers: [
    { phoneNumber: '0709876543', type: 'mobile', isMainNumber: true },
  ],
  emailAddress: '',
  isTenant: true,
  autogiro: false,
  invoiceDeliveryMethod: InvoiceDeliveryMethod.Other,
  protectedIdentity: false,
  deceased: false,
  emigrated: false,
  noAdvertising: false,
  ...overrides,
})

export const createMockXpandInvoice = (
  overrides: Partial<RentInvoice> = {}
): RentInvoice => ({
  invoiceNumber: 'XINV001',
  reference: 'XPA-NDR-00-2002/01',
  roundoff: 0,
  fromDate: new Date('2023-01-01'),
  toDate: new Date('2023-01-31'),
  invoiceDate: new Date('2023-01-01'),
  expiryDate: new Date('2023-01-31'),
  lastDebitDate: new Date('2023-06-30'),
  careOf: undefined,
  ...overrides,
})

export const createMockXpandInvoiceRow = (
  overrides: Partial<RentInvoiceRow> = {}
): RentInvoiceRow => ({
  type: 'Rent',
  invoiceNumber: 'XINV001',
  text: 'Hyra bostad',
  rentType: null,
  code: null,
  rowType: 1,
  amount: 4000,
  reduction: 0,
  vat: 0,
  fromDate: new Date('2023-01-01'),
  toDate: new Date('2023-01-31'),
  printGroup: 'N',
  ...overrides,
})

export const createMockXpandRentalProperty = (
  overrides: Partial<RentalProperty> = {}
): RentalProperty => ({
  rentalPropertyId: 'XPA-NDR-00-2002',
  apartmentNumber: 0,
  size: 42,
  type: 'Lägenhet',
  address: {
    street: 'Xpand Street 2',
    number: '',
    postalCode: '54321',
    city: 'Xpand City',
  },
  rentalPropertyType: 'bostad',
  additionsIncludedInRent: '',
  otherInfo: undefined,
  roomTypes: undefined,
  lastUpdated: undefined,
  ...overrides,
})

/** A header row naming the lease, followed by the rows of its print group. */
export const createMockXpandInvoiceRows = (): RentInvoiceRow[] => [
  createMockXpandInvoiceRow({
    rowType: 3,
    text: 'XPA-NDR-00-2002/01 Xpand Street 2',
    printGroup: null,
    amount: 0,
  }),
  createMockXpandInvoiceRow({ text: 'Hyra bostad', amount: 4000 }),
  createMockXpandInvoiceRow({ text: 'Värme', amount: 500, vat: 125 }),
]

export const getContacts = jest.fn()
export const getInvoices = jest.fn()
export const getRentalProperties = jest.fn()
export const getInvoiceRows = jest.fn()

// By default Tenfast has everything, so Xpand finds nothing
export const setupDefaultMocks = () => {
  getContacts.mockResolvedValue([])
  getInvoices.mockResolvedValue([])
  getRentalProperties.mockResolvedValue([])
  getInvoiceRows.mockResolvedValue([])
}

export const resetMocks = () => {
  getContacts.mockReset()
  getInvoices.mockReset()
  getRentalProperties.mockReset()
  getInvoiceRows.mockReset()
}
