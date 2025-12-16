import { InvoicePaymentEvent } from '@onecore/types'
import {
  getAllInvoicePaymentEvents,
  getAllInvoicesWithMatchIds,
} from '../common/adapters/xledger-adapter'
import { getInvoiceRows } from '../common/adapters/xpand-db-adapter'
import { InvoicePaymentSummary } from './types'
import { RentInvoiceRow } from '../common/types'
import { logger } from '@onecore/utilities'

export const getInvoicePaymentSummaries = async (from: Date, to: Date) => {
  logger.info(
    `Getting invoices from Xledger between ${from.toISOString()} and ${to.toISOString()}`
  )
  const xledgerInvoices = await getAllInvoicesWithMatchIds(from, to)
  logger.info(`Got ${xledgerInvoices.length} invoices`)

  const fullyOrPartiallyPaidRentInvoices = xledgerInvoices.filter(
    (i) =>
      i.invoiceId.startsWith('55') && // Rent invoice numbers start with 55
      i.paidAmount !== undefined &&
      i.paidAmount > 0
  )
  logger.info(
    `${fullyOrPartiallyPaidRentInvoices.length} fully or partially paid rent invoices`
  )

  logger.info('Getting payment events and invoice rows')

  const [allInvoiceRows, allPaymentEvents] = await Promise.all([
    fetchInvoiceRowsChunked(
      fullyOrPartiallyPaidRentInvoices.map((i) => i.invoiceId)
    ),
    getAllInvoicePaymentEvents(
      fullyOrPartiallyPaidRentInvoices.map((m) => m.matchId)
    ),
  ])

  logger.info(`Got ${allInvoiceRows.length} invoice rows`)
  logger.info(`Got ${allPaymentEvents.length} payment events`)

  const filteredInvoiceRows = allInvoiceRows.filter(
    (r) =>
      r.code?.startsWith('HEMFÖR') ||
      r.code?.startsWith('HYRSÄT') ||
      r.code?.startsWith('VHK')
  )

  const filteredPaymentEvents = allPaymentEvents
    .filter((pe) => pe.amount < 0) // We only want payments, not credits
    .map((pe) => {
      return {
        ...pe,
        paymentDate: new Date(pe.paymentDate),
      }
    })

  const paymentEventsByInvoiceId = fullyOrPartiallyPaidRentInvoices.reduce<
    Record<string, InvoicePaymentEvent[]>
  >((acc, i) => {
    const paymentEventsForInvoice = filteredPaymentEvents.filter(
      (e) =>
        e.matchId === i.matchId && e.paymentDate >= from && e.paymentDate <= to
    )

    acc[i.invoiceId] = paymentEventsForInvoice

    return acc
  }, {})

  const invoicePaymentSummaries: InvoicePaymentSummary[] = []

  fullyOrPartiallyPaidRentInvoices.forEach((i) => {
    const invoiceRowsForInvoice = filteredInvoiceRows.filter(
      (r) => r.invoiceNumber === i.invoiceId
    )

    if (invoiceRowsForInvoice.length === 0) {
      return
    }

    const hemfor = invoiceRowsForInvoice.find((r) =>
      r.code?.startsWith('HEMFÖR')
    )
    const hyrsat = invoiceRowsForInvoice.find((r) =>
      r.code?.startsWith('HYRSÄT')
    )

    const hemforTotal = hemfor
      ? hemfor.amount + hemfor.reduction + hemfor.vat
      : 0
    const hyrsatTotal = hyrsat
      ? hyrsat.amount + hyrsat.reduction + hyrsat.vat
      : 0

    const vhkRows = invoiceRowsForInvoice.filter((row) =>
      row.code?.startsWith('VHK')
    )
    const vhk906Total = getVerksamhetskostnadTotal(vhkRows, 'VHK906')
    const vhk933Total = getVerksamhetskostnadTotal(vhkRows, 'VHK933')
    const vhk934Total = getVerksamhetskostnadTotal(vhkRows, 'VHK934')
    const vhk936Total = getVerksamhetskostnadTotal(vhkRows, 'VHK936')

    paymentEventsByInvoiceId[i.invoiceId].forEach((pe) => {
      const fractionPaid = Math.min(-pe.amount / i.amount, 1) // Max 1 in case an invoice is overpaid

      invoicePaymentSummaries.push({
        ...i,
        paymentDate: pe.paymentDate,
        amountPaid: -pe.amount,
        fractionPaid,
        hemforTotal,
        hemforPaid: hemforTotal * fractionPaid,
        hyrsatTotal,
        hyrsatPaid: hyrsatTotal * fractionPaid,
        vhk906Total,
        vhk906Paid: vhk906Total * fractionPaid,
        vhk933Total,
        vhk933Paid: vhk933Total * fractionPaid,
        vhk934Total,
        vhk934Paid: vhk934Total * fractionPaid,
        vhk936Total,
        vhk936Paid: vhk936Total * fractionPaid,
      })
    })
  })

  return invoicePaymentSummaries
}

const fetchInvoiceRowsChunked = async (invoiceIds: string[]) => {
  const chunkSize = 1000
  const invoiceRows: RentInvoiceRow[] = []

  for (let start = 0; start < invoiceIds.length; start += chunkSize) {
    const rowsInChunk = await getInvoiceRows(
      invoiceIds.slice(start, start + chunkSize)
    )
    invoiceRows.push(...rowsInChunk)
  }

  return invoiceRows
}

const getVerksamhetskostnadTotal = (rows: RentInvoiceRow[], code: string) => {
  const vhkRow = rows.find((r) => r.code === code)
  return vhkRow ? vhkRow.amount + vhkRow.reduction + vhkRow.vat : 0
}
