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
  type: string
  rentalPropertyId: string
  rentalProperty: RentalProperty | undefined
  lastUpdated: Date | undefined
}

interface RentalProperty {
  rentalPropertyId: string
  leaseId: string | undefined
  lease: Lease | undefined
  apartmentNumber: number
  size: number
  type: string
  address: Address | undefined
  rentalPropertyType: string
  additionsIncludedInRent: string
  otherInfo: string | undefined
  lastUpdate: Date | undefined
}

interface Address {
  street: string
  number: string
  postalCode: string
  city: string
}

enum LeaseStatus {
  Active,
}

export { Contact, Lease, RentalProperty, LeaseStatus, Address }
