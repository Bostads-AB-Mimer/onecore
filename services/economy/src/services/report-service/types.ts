import { Invoice } from '@onecore/types'

export type InvoiceWithMatchId = Invoice & {
  matchId: number
}

export type InvoicePaymentSummary = Invoice & {
  paymentDate: Date
  amountPaid: number
  fractionPaid: number
  hemforTotal: number
  hemforPaid: number
  hyrsatTotal: number
  hyrsatPaid: number
  vhk906Total: number
  vhk906Paid: number
  vhk933Total: number
  vhk933Paid: number
  vhk934Total: number
  vhk934Paid: number
  vhk936Total: number
  vhk936Paid: number
}
