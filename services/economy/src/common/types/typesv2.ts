import { Contact, Invoice, InvoiceRow } from '@onecore/types'

export const TOTAL_ACCOUNT = '2970'
export const CUSTOMER_LEDGER_ACCOUNT = '1530'

export enum InvoiceDeliveryMethod {
  Email = '14001',
  Other = '14002',
}

export enum CustomerGroup {
  OtherPaymentMethod = 'STD',
  AutoGiro = 'AG',
  CounterPart = 'KI',
}

export type XpandContact = Contact & {
  autogiro: boolean
  invoiceDeliveryMethod: InvoiceDeliveryMethod
  careOf?: string
}

export type InvoiceRowWithAccounting = InvoiceRow & {
  rentArticleName?: string
  projectCode?: string
  property?: string
  freeCode?: string
  costCode?: string
  account?: string
}

export type InvoiceWithAccounting = Omit<Invoice, 'invoiceRows'> & {
  invoiceRows: InvoiceRowWithAccounting[]
  ledgerAccount?: string
  totalAccount?: string
  counterPartCode?: string
}

export type CounterPartCustomer = {
  customerName: string
  counterPartCode: string
  ledgerAccount: string
  totalAccount: string
}

export type CounterPartCustomers = {
  customers: CounterPartCustomer[]
  find: (
    customers: CounterPartCustomer[],
    customerName: string
  ) => CounterPartCustomer | undefined
}

export type AdapterResult<T, E> =
  | { ok: true; data: T; statusCode?: number }
  | { ok: false; err: E; statusCode?: number }

export const xledgerDateString = (date: string | null | undefined) => {
  if (date) {
    return date.replaceAll('-', '')
  } else {
    return ''
  }
}

export type ExportedInvoiceRow = {
  amount?: number
  deduction?: number
  vat?: number
  rowTotalAmount?: number
  invoiceTotalAmount?: number
  invoiceDate?: Date
  invoiceDueDate?: Date
  invoiceNumber?: string
  invoiceRowText?: string | null
  fromDate?: Date
  toDate?: Date
  contractCode?: string
  rentArticle?: string | null
  rentArticleName?: string | null
  account?: string
  costCode?: string
  property?: string
  projectCode?: string
  freeCode?: string
  totalAccount?: string
  ledgerAccount?: string
  contactCode?: string
  tenantName?: string
  company?: string
  counterPartCode?: string | undefined

  // remove?
  roundoff?: number
}

export type AggregatedRow = {
  amount: number
  vat: number
  account: string
  voucherDate: string
  voucherNumber?: string
  fromDate: string
  toDate: string
  costCode?: string
  property?: string
  projectCode?: string
  freeCode?: string
  totalAccount: string
  counterPartCode?: string
}

export type LedgerRow = {
  invoiceNumber?: string
  ocr?: string
  amount: number
  vat: number
  account?: string
  invoiceDate?: string
  invoiceDueDate?: string
  recipientContactCode?: string
  voucherDate: string
  voucherNumber: string
  counterPartCode?: string
}
