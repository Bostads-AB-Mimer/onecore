import {
  getAllInvoicePaymentEvents,
  getAllInvoicesWithMatchIds,
} from '../common/adapters/xledger-adapter'
import {
  getInvoiceRows,
  getInvoicesForReport,
} from '../common/adapters/xpand-db-adapter'
import { InvoicePaymentSummary } from './types'

export const getInvoicePaymentSummaries = async (from: Date, to: Date) => {
  const xledgerInvoices = await getAllInvoicesWithMatchIds(from, to)

  const fullyOrPartiallyPaidInvoices = xledgerInvoices.filter(
    (i) => i.paidAmount !== undefined && i.paidAmount > 0
  )

  const allPaymentEvents = await getAllInvoicePaymentEvents(
    fullyOrPartiallyPaidInvoices.map((m) => m.matchId)
  )

  const invoicesWithPaymentEvents = fullyOrPartiallyPaidInvoices.map((i) => {
    const paymentEventsForInvoice = allPaymentEvents.filter(
      (e) =>
        e.matchId === i.matchId && e.paymentDate >= from && e.paymentDate <= to
    )

    return {
      ...i,
      paymentEvents: paymentEventsForInvoice,
    }
  })

  const invoices = await getInvoicesForReport(
    '001',
    invoicesWithPaymentEvents.map((i) => i.invoiceId)
  )

  const invoiceRows = await getInvoiceRows(invoices.map((i) => i.invoiceId))

  const invoicePaymentSummaries: InvoicePaymentSummary[] = []

  invoices.forEach((i) => {
    const invoiceRowsForInvoice = invoiceRows.filter(
      (r) => r.invoiceNumber === i.invoiceId
    )

    const hemfor = invoiceRowsForInvoice.find((r) =>
      r.code?.startsWith('HEMFÖR')
    )
    const hyrsat = invoiceRowsForInvoice.find((r) =>
      r.code?.startsWith('HYRSÄT')
    )
    const vhk = invoiceRowsForInvoice.find((r) => r.code?.startsWith('VHK'))

    const hemforTotal = hemfor
      ? hemfor.amount + hemfor.reduction + hemfor.vat
      : 0
    const hyrsatTotal = hyrsat
      ? hyrsat.amount + hyrsat.reduction + hyrsat.vat
      : 0
    const vhkTotal = vhk ? vhk.amount + vhk.reduction + vhk.vat : 0

    const paymentEvents = invoicesWithPaymentEvents.find(
      (ipe) => ipe.invoiceId === i.invoiceId
    )?.paymentEvents

    paymentEvents?.forEach((pe) => {
      const fractionPaid = -pe.amount / i.amount

      invoicePaymentSummaries.push({
        ...i,
        paymentDate: pe.paymentDate,
        paidAmount: -pe.amount,
        fractionPaid,
        hemforTotal,
        hemforPaid: hemforTotal * fractionPaid,
        hyrsatTotal,
        hyrsatPaid: hyrsatTotal * fractionPaid,
        vhkTotal,
        vhkPaid: vhkTotal * fractionPaid,
      })
    })
  })

  return invoicePaymentSummaries
}
