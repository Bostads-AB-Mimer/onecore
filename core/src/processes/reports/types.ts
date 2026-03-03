import { Contact, Invoice, Lease } from '@onecore/types'

export type InvoicePaymentSummary = Invoice & {
  fractionPaid: number
  hemforTotal: number
  hemforDebt: number
  hyrsatTotal: number
  hyrsatDebt: number
  vhk906Total: number
  vhk906Debt: number
  vhk933Total: number
  vhk933Debt: number
  vhk934Total: number
  vhk934Debt: number
  vhk936Total: number
  vhk936Debt: number
}

export type BosocialaObject = Invoice & {
  lease?: Lease
  costCentre?: string
  daysSinceExpirationDate: number
  contact?: Contact
}
