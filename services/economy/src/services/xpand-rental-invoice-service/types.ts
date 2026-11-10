export type LedgerInvoice = {
  contractCode: string
  invoiceNumber: string
  invoiceFromDate: string
  invoiceToDate: string
  invoiceDate: string
  ledgerAccount: string
  totalAccount: string
  tenantName: string
}

export type InvoiceContract = {
  invoiceNumber: string
  invoiceFromDate: string
  invoiceToDate: string
  ledgerAccount: string
  totalAccount: string
  counterPart?: string | undefined
  tenantName: string
}

export type InvoiceImportError = { invoiceNumber: string; error: string }
