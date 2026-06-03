import {
  Contact,
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  Lease,
  LeaseStatus,
  LeaseType,
  PaymentStatus,
  RentalProperty,
} from '@onecore/types'

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
  isTenant: true,
  protectedIdentity: false,
  deceased: false,
  emigrated: false,
  noAdvertising: false,
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

export const createMockLease = (overrides: Partial<Lease> = {}): Lease => ({
  leaseId: 'REN-TAL-00-1001/01',
  leaseNumber: '1',
  leaseStartDate: new Date('2020-01-01'),
  leaseEndDate: undefined,
  status: LeaseStatus.Current,
  tenantContactIds: undefined,
  tenants: undefined,
  rentalPropertyId: 'REN-TAL-00-1001',
  rentalObject: undefined,
  type: LeaseType.HousingContract,
  lastDebitDate: undefined,
  noticeGivenBy: undefined,
  noticeDate: undefined,
  noticeTimeTenant: undefined,
  preferredMoveOutDate: undefined,
  terminationDate: undefined,
  contractDate: undefined,
  approvalDate: undefined,
  residentialArea: undefined,
  rentRows: [],
  ...overrides,
})

export const createMockRentInvoice = (
  overrides: Partial<Invoice> = {}
): Invoice => ({
  invoiceId: 'INV001',
  leaseIds: ['REN-TAL-00-1001/01'],
  amount: 5000,
  reference: 'INV001',
  fromDate: new Date('2023-01-01'),
  toDate: new Date('2023-01-31'),
  invoiceDate: new Date('2023-01-01'),
  expirationDate: new Date('2023-01-31'),
  debitStatus: 0,
  paymentStatus: PaymentStatus.Unpaid,
  transactionType: InvoiceTransactionType.Rent,
  transactionTypeName: 'Hyra',
  type: 'Regular',
  source: 'next',
  invoiceRows: [
    createMockRentInvoiceRow({
      printGroup: 'N',
      invoiceRowText: 'Hyra bostad',
      amount: 5000,
    }),
  ],
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
  rentalPropertyType: 'bostad',
  additionsIncludedInRent: '',
  otherInfo: undefined,
  roomTypes: undefined,
  lastUpdated: undefined,
  ...overrides,
})

// Mock functions
export const getContactByContactCode = jest.fn()
export const getInvoiceByOcr = jest.fn()
export const getLease = jest.fn()
export const getRentalProperty = jest.fn()

export const setupDefaultMocks = () => {
  getContactByContactCode.mockResolvedValue({
    ok: true,
    data: createMockContact(),
  })
  getInvoiceByOcr.mockResolvedValue({ ok: true, data: createMockRentInvoice() })
  getLease.mockResolvedValue({ ok: true, data: createMockLease() })
  getRentalProperty.mockResolvedValue({
    ok: true,
    data: createMockRentalProperty(),
  })
}

export const resetMocks = () => {
  getContactByContactCode.mockReset()
  getInvoiceByOcr.mockReset()
  getLease.mockReset()
  getRentalProperty.mockReset()
}
