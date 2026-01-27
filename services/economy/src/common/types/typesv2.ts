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

export const xledgerDateString = (date: Date | null | undefined) => {
  if (date) {
    return date.toISOString().substring(0, 10).replaceAll('-', '')
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
}
