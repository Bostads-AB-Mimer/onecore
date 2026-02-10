export interface CustomerLeaseContract {
  leaseId: string
  objectNumber: string
  propertyName: string
  buildingName: string
  district: string
  address: string
}

export interface CustomerSearchResult {
  customerNumber: string
  personalNumber: string
  firstName: string
  lastName: string
  fullName: string
  leaseContracts: CustomerLeaseContract[]
}

export interface InvoiceRow {
  text: string
  amount: number
  price: number
}
