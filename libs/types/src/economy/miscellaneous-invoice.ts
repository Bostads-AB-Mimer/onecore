export interface MiscellaneousInvoicePayload {
  reference: string
  invoiceDate: Date
  contactCode: string
  tenantName: string
  leaseId: string
  costCentre?: string
  propertyCode?: string
  invoiceRows: MiscellaneousInvoiceRow[]
  administrativeCosts: boolean
  comment?: string
  projectCode?: string
  attachment?: any // TODO Fix type, should be File
}

export interface MiscellaneousInvoiceArticle {
  id: string
  name: string
  standardPrice: number
  vatExcluded?: boolean
}

export interface MiscellaneousInvoiceRow {
  amount: number
  price: string
  article?: MiscellaneousInvoiceArticle
  text?: string
}
