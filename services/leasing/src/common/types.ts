interface Contact {
  contactId: string
  leaseId: string | undefined
  lease: Lease | undefined
  firstName: string
  lastName: string
  fullName: string
  type: string
  nationalRegistrationNumber: string
  birthDate: Date
  address: Address | undefined
  mobilePhone: string
  phoneNumber: string
  emailAddress: string
  lastUpdated: Date | undefined
}

interface Lease {
  leaseId: string
  leaseNumber: string
  leaseStartDate: Date
  leaseEndDate: Date | undefined
  status: LeaseStatus
  tenantContactIds: string[] | undefined
  tenants: Contact[] | undefined
  rentalPropertyId: string
  rentalProperty: RentalProperty | undefined
  type: string
  rentInfo: RentInfo | undefined
  lastUpdated: Date | undefined
}

interface RentalProperty {
  rentalPropertyId: string
  apartmentNumber: number
  size: number
  type: string
  address: Address | undefined
  rentalPropertyType: string
  additionsIncludedInRent: string
  otherInfo: string | undefined
  lastUpdated: Date | undefined
}

interface Address {
  street: string
  number: string
  postalCode: string
  city: string
}

interface RentInfo {
  currentRent: Rent
  futureRents: Array<Rent> | undefined
}

interface Rent {
  rentId: string
  leaseId: string
  currentRent: number
  additionalChargeDescription: string | undefined
  additionalChargeAmount: number | undefined
  rentStartDate: Date
  rentEndDate: Date | undefined
}
enum LeaseStatus {
  Active,
}

export { Contact, Lease, RentalProperty, LeaseStatus, Address, Rent, RentInfo }
