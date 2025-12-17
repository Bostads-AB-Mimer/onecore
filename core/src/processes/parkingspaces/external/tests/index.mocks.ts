import {
  ConsumerReport,
  Contact,
  Invoice,
  InvoiceTransactionType,
  Lease,
  LeaseStatus,
  ParkingSpace,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
  PaymentStatus,
} from '@onecore/types'

export const mockedParkingSpace: ParkingSpace = {
  parkingSpaceId: '123-456-789/0',
  address: {
    street: 'Gatan',
    number: '1',
    postalCode: '12345',
    city: 'Västerås',
  },
  rent: {
    currentRent: {
      currentRent: 123,
      vat: 0,
      rentStartDate: undefined,
      rentEndDate: undefined,
      additionalChargeAmount: undefined,
      additionalChargeDescription: undefined,
    },
    futureRents: undefined,
  },
  type: ParkingSpaceType.Garage,
  applicationCategory: ParkingSpaceApplicationCategory.external,
  vacantFrom: new Date(),
}

export const mockedApplicantWithoutLeases: Contact = {
  contactCode: 'P12345',
  contactKey: 'ABC',
  address: {
    street: 'Gata',
    number: '2',
    postalCode: '54321',
    city: 'Västerås',
  },
  birthDate: new Date(),
  firstName: 'Foo',
  lastName: 'Bar',
  fullName: 'Foo Bar',
  nationalRegistrationNumber: '1212121212',
  phoneNumbers: [],
  emailAddress: 'test@mimer.nu',
  isTenant: true,
}

export const mockedApplicantWithoutAddress: any = {
  contactCode: 'P12345',
  contactKey: 'ABC',
  address: {
    street: null,
    number: null,
    postalCode: null,
    city: null,
  },
  birthDate: new Date(),
  firstName: 'Foo',
  lastName: 'Bar',
  fullName: 'Foo Bar',
  nationalRegistrationNumber: '1212121212',
  phoneNumbers: [],
  emailAddress: 'test@mimer.nu',
  isTenant: true,
}

export const mockedApplicantWithLeases: Contact = {
  leaseIds: ['123-456-789/01', '789-456-123/02'],
  ...mockedApplicantWithoutLeases,
}

export const successfulConsumerReport: ConsumerReport = {
  pnr: '1212121212',
  template: 'template',
  address: 'address',
  city: 'city',
  status: '1',
  errorList: [],
  name: 'Tolvan Tolvansson',
  status_text: 'Godkänd',
  zip: '12345',
}

export const failedConsumerReport: ConsumerReport = {
  pnr: '1212121212',
  template: 'template',
  address: 'address',
  city: 'city',
  status: '2',
  errorList: [
    {
      Cause_of_Reject: 'P24',
      Reject_comment: '',
      Reject_text: 'Scoring',
    },
  ],
  name: 'Tolvan Tolvansson',
  status_text: 'Ej Godkänd',
  zip: '12345',
}

export const mockedLease: Lease = {
  leaseId: '123-456-789/0',
  approvalDate: undefined,
  contractDate: undefined,
  lastDebitDate: undefined,
  leaseEndDate: undefined,
  leaseNumber: '123',
  leaseStartDate: new Date(),
  noticeDate: undefined,
  noticeGivenBy: 'tenant',
  noticeTimeTenant: '',
  preferredMoveOutDate: undefined,
  rentalPropertyId: '123-456-789',
  status: LeaseStatus.Current,
  tenantContactIds: ['P12345'],
  tenants: undefined,
  terminationDate: undefined,
  type: '',
}

export const mockedPaidInvoice: Invoice = {
  invoiceId: 'INV-001',
  leaseId: '123-456-789/0',
  amount: 1000,
  reference: 'REF-001',
  fromDate: new Date(),
  toDate: new Date(),
  invoiceDate: new Date(),
  expirationDate: undefined,
  debitStatus: 0,
  paymentStatus: PaymentStatus.Paid,
  transactionType: InvoiceTransactionType.Rent,
  transactionTypeName: 'Rent',
  paidAmount: undefined,
  daysSinceLastDebitDate: undefined,
  description: 'Parking rent',
  sentToDebtCollection: undefined,
  type: 'Regular',
  source: 'legacy',
  invoiceRows: [],
  credit: null,
}

export const mockedUnpaidInvoice: Invoice = {
  invoiceId: 'INV-002',
  leaseId: '123-456-789/0',
  amount: 1000,
  reference: 'REF-001',
  fromDate: new Date(),
  toDate: new Date(),
  invoiceDate: new Date(),
  expirationDate: undefined,
  debitStatus: 0,
  paymentStatus: PaymentStatus.Unpaid,
  transactionType: InvoiceTransactionType.Reminder,
  transactionTypeName: 'Rent',
  paidAmount: undefined,
  daysSinceLastDebitDate: undefined,
  description: 'Parking rent',
  sentToDebtCollection: undefined,
  type: 'Regular',
  source: 'legacy',
  invoiceRows: [],
  credit: null,
}
