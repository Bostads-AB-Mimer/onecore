export interface MiscellaneousInvoicePayload {
  invoiceDate: Date
  contactCode: string
  tenantName: string
  leaseId: string
  costCentre?: string
  propertyCode?: string
  invoiceRows: MiscellaneousInvoiceRow[]
  administrativeCosts: boolean
  handlingFee: boolean
  comment?: string
  projectCode?: string
  // @ts-expect-error
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  attachment?: File // TODO fix type
}

export interface MiscellaneousInvoiceRow {
  text: string
  amount: number
  price: number
  articleName: string
  articleId: string
}
