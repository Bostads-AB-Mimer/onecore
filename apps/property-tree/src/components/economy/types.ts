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
  articleName: string
  articleId: string
}

export interface MiscellaneousInvoicePayload {
  invoiceDate: Date
  contactCode: string
  tenantName: string
  leaseId: string
  costCentre?: string
  propertyCode?: string
  invoiceRows: InvoiceRow[]
  administrativeCosts: boolean
  handlingFee: boolean
  comment?: string
  projectCode?: string
  attachment?: File
}
