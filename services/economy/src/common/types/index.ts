import { Contact } from 'onecore-types'

export const TOTAL_ACCOUNT = '2970'
export const CUSTOMER_LEDGER_ACCOUNT = '1530'

export const columnIndexes: Record<string, number> = {
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
}

export enum CustomerGroup {
  OtherPaymentMethod = 'STD',
  AutoGiro = 'AG',
  CounterPart = 'KI',
}

export enum InvoiceDeliveryMethod {
  Email = '14001',
  Other = '14002',
}

export const columnNames: string[] = [
  'contractCode',
  'contactCode',
  'tenantName',
  'contractType',
  'contractFromDate',
  'invoiceFromDate',
  'invoiceToDate',
  'rentArticle',
  'invoiceRowText',
  'contractArea',
  'sumContractArea',
  'rentalObjectCode',
  'rentalObjectName',
  'amount',
  'vat',
  'totalAmount',
  'account',
  'costCode',
  'projectCode',
  'freeCode',
  'sumRow',
]

export type XpandContact = Contact & {
  autogiro: boolean
  invoiceDeliveryMethod: InvoiceDeliveryMethod
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
  contractCode: string
  invoiceFromDate: string
  invoiceToDate: string
  ledgerAccount: string
  totalAccount: string
  tenantName: string
}

export type AdapterResult<T, E> =
  | { ok: true; data: T; statusCode?: number }
  | { ok: false; err: E; statusCode?: number }

export const xledgerDateString = (date: Date) => {
  return date.toISOString().substring(0, 10).replaceAll('-', '')
}
