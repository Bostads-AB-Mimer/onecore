import { Invoice } from '@onecore/types'

export type InvoiceWithMatchId = Invoice & { matchId: number }

export type InvoicePaymentSummary = Invoice & {
  paymentDate: Date
  fractionPaid: number
  hemforTotal: number
  hemforPaid: number
  hyrsatTotal: number
  hyrsatPaid: number
  vhkTotal: number
  vhkPaid: number
}
