import { Contact } from '@onecore/types'

export const TOTAL_ACCOUNT = '2970'
export const CUSTOMER_LEDGER_ACCOUNT = '1530'

/*export const columnIndexes: Record<string, number> = {
  contractCode: 1,
  contactCode: 2,
  tenantName: 3,
  contractType: 4,
  contractFromDate: 5,
  invoiceFromDate: 6,
  invoiceToDate: 7,
  rentArticle: 8,
  invoiceRowText: 9,
  contractArea: 10,
  sumContractArea: 11,
  rentalObjectCode: 12,
  rentalObjectName: 13,
  amount: 14,
  vat: 15,
  totalAmount: 16,
  account: 17,
  costCode: 18,
  projectCode: 19,
  freeCode: 20,
  sumRow: 21,
}*/

export enum CustomerGroup {
  OtherPaymentMethod = 'STD',
  AutoGiro = 'AG',
  CounterPart = 'KI',
}

export enum InvoiceDeliveryMethod {
  Email = '14001',
  Other = '14002',
}

export const columnIndexes: Record<string, number> = {
  rentArticle: 1,
  invoiceRowText: 2,
  totalAmount: 3,
  invoiceDate: 4,
  deferDate: 5,
  numberOfArticles: 6,
  pricePerArticle: 7,
  deduction: 8,
  accountingDate: 9,
  debitState: 10,
  unit: 11,
  invoiceAmount: 12,
  invoiceType: 13,
  company: 14,
  companyName: 15,
  dueDate: 16,
  contactCode: 17,
  tenantName: 18,
  amount: 19,
  vat: 20,
  paymentStatus: 21,
  remainingPayment: 22,
  finalPaymentDate: 23,
  transactionType: 24,
  voucherId: 25,
  contractCode: 26,
  invoiceNumber: 27,
}

export const columnNames: string[] = [
  'rentArticle',
  'invoiceRowText',
  'totalAmount',
  'invoiceDate',
  'deferDate',
  'numberOfArticles',
  'pricePerArticle',
  'deduction',
  'accountingDate',
  'debitState',
  'unit',
  'invoiceAmount',
  'invoiceType',
  'company',
  'companyName',
  'dueDate',
  'contactCode',
  'tenantName',
  'amount',
  'vat',
  'paymentStatus',
  'remainingPayment',
  'finalPaymentDate',
  'transactionType',
  'voucherId',
  'contractCode',
  'invoiceNumber',
]

export type XpandContact = Contact & {
  autogiro: boolean
  invoiceDeliveryMethod: InvoiceDeliveryMethod
  careOf?: string
}

export type InvoiceDataRow = Record<string, string | number>

export type Invoice = Record<string, string | number | Date>

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
  tenantName: string
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
  account?: string
  costCode?: string
  property?: string
  freeCode?: string
  totalAccount?: string
  ledgerAccount?: string
  contactCode?: string
  tenantName?: string
  company?: string

  // remove?
  roundoff?: number
}
