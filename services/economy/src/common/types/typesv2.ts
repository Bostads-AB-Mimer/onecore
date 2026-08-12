import { Contact, Invoice, InvoiceRow } from '@onecore/types'
import { TenfastRentalLoss } from '../adapters/tenfast/schemas'
import { z } from 'zod'

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

export type ArticleAccountConfiguration = {
  accountNr: number
  debitType: string
  costCenter: string
  property: string
  projectCode: string
  freeText: string
}

export type InvoiceRowWithAccounting = InvoiceRow & {
  mimerCompanyCode?: string
  rentArticleName?: string
  projectCode?: string
  property?: string
  freeCode?: string
  costCode?: string
  account?: string
  taxRule?: string
}

export type InvoiceWithAccounting = Omit<Invoice, 'invoiceRows'> & {
  invoiceRows: InvoiceRowWithAccounting[]
  ledgerAccount?: string
  totalAccount?: string
  counterPartCode?: string
  roundOffCostCode?: string
}

export type RentalLoss = {
  rentalLossRows: RentalLossRow[]
  rentalObject: string
  month: string
  days: {
    totalInMonth: number
    // Days covered by a contract during the month, as reported by the source
    // system. Unaffected by the interval split below.
    contracted: number
    // Days in this rental loss' uncontractedInterval, not in the whole month.
    uncontracted: number
  }
  // A rental loss always covers exactly one uncontracted interval. A source
  // rental loss with several uncontracted intervals in the same month is split
  // into one RentalLoss per interval, with the amounts prorated accordingly.
  uncontractedInterval: RentalLossInterval
}

export type RentalLossRow = {
  amount: number
  totalAmount: number
  vat: number
  mimerCompanyCode?: string
  rentArticleName?: string
  rentalObject?: string
  incomeAccount: number
  incomeProjectCode?: string
  incomeProperty?: string
  incomeFreeCode?: string
  incomeCostCode?: string
  costAccount: number
  costProjectCode?: string
  costProperty?: string
  costFreeCode?: string
  costCostCode?: string
  taxRule?: string
  // Present when a rental block split this row into a sub-interval of the
  // rental loss' uncontractedInterval. When absent, the rental loss'
  // uncontractedInterval applies.
  fromDate?: Date
  toDate?: Date
  // True when this row was produced by a rental block (i.e. the cost side
  // has been replaced with the block's accounting). False/absent for plain
  // rental loss rows.
  isBlock?: boolean
}

export type RentalLossInterval = {
  from: Date
  to: Date
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
  totalAmount?: number
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
  taxRule?: string

  // remove?
  roundoff?: number
}

export type AggregatedRow = {
  amount: number
  totalAmount: number
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
  taxRule?: string
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

export type TenfastRentalObject = {
  _id: string
  externalId: string
}

export type MimerCompany = {
  name: string
  xpandId: string
  tenfastId: string
  roundOffCostCode?: string
}

export type RentalBlockWithAccounting = {
  account: string
  projectCode?: string
  costCode?: string
  property?: string
  freeCode?: string
  fromDate: Date
  // Null when the block has no defined end date (open-ended block).
  toDate: Date | null
  description: string
}
