import type { File } from 'node:buffer'

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
  attachment?: File
}

export interface MiscellaneousInvoiceRow {
  amount: number
  price: string
  articleName: string
  articleId: string
  text?: string
}
