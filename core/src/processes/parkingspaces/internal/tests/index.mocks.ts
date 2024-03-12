import {
  ConsumerReport,
  Contact,
  Lease,
  LeaseStatus,
  ParkingSpace,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
} from 'onecore-types'

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
  applicationCategory: ParkingSpaceApplicationCategory.internal,
  vacantFrom: new Date(),
}

export const mockedApplicant: Contact = {
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
export const mockedLeases: Lease[] = [
  {
    leaseId: '123-456-789/0',
    address: {
      street: 'Gatustigen',
      number: '123',
      city: 'Västerås',
      postalCode: '12345',
    },
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
    rentalProperty: undefined,
    rentalPropertyId: '123-456-789',
    rentInfo: {
      currentRent: {
        currentRent: 123,
        additionalChargeAmount: undefined,
        additionalChargeDescription: undefined,
        rentEndDate: undefined,
        rentStartDate: undefined,
        vat: 0,
      },
      futureRents: undefined,
    },
    status: LeaseStatus.Active,
    tenantContactIds: ['P12345'],
    tenants: undefined,
    terminationDate: undefined,
    type: '',
  },
]
