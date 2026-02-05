import assert from 'node:assert'
import { getAllInvoicesWithMatchIds } from '../common/adapters/xledger-adapter'
import { getInvoiceRows } from '../common/adapters/xpand-db-adapter'
import { InvoicePaymentSummary } from './types'
import { RentInvoiceRow } from '../common/types'
import { logger } from '@onecore/utilities'

export const getUnpaidInvoicePaymentSummaries = async (
  from?: Date,
  to?: Date
) => {
  logger.info('Getting unpaid invoices from Xledger')
  const xledgerInvoices = await getAllInvoicesWithMatchIds({
    from,
    to,
    remainingAmountGreaterThan: 0,
  })
  logger.info(`Got ${xledgerInvoices.length} invoices`)

  const rentInvoices = xledgerInvoices.filter(
    (i) => i.invoiceId.startsWith('55') // Rent invoice numbers start with 55
  )
  logger.info(`${rentInvoices.length} unpaid rent invoices`)

  logger.info('Getting invoice rows')

  const allInvoiceRows = await fetchInvoiceRowsChunked(
    rentInvoices.map((i) => i.invoiceId)
  )

  logger.info(`Got ${allInvoiceRows.length} invoice rows`)

  const filteredInvoiceRows = allInvoiceRows.filter(
    (r) =>
      r.code?.startsWith('HEMFÖR') ||
      r.code?.startsWith('HYRSÄT') ||
      r.code?.startsWith('VHK')
  )

  const invoicePaymentSummaries: InvoicePaymentSummary[] = []

  rentInvoices.forEach((i) => {
    assert(
      i.paidAmount !== undefined,
      `Invoice ${i.invoiceId} is missing paidAmount`
    )

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

    const fractionPaid = i.paidAmount / i.amount

    invoicePaymentSummaries.push({
      ...i,
      fractionPaid,
      hemforTotal,
      hemforDebt: hemforTotal - hemforTotal * fractionPaid,
      hyrsatTotal,
      hyrsatDebt: hyrsatTotal - hyrsatTotal * fractionPaid,
      vhk906Total,
      vhk906Debt: vhk906Total - vhk906Total * fractionPaid,
      vhk933Total,
      vhk933Debt: vhk933Total - vhk933Total * fractionPaid,
      vhk934Total,
      vhk934Debt: vhk934Total - vhk934Total * fractionPaid,
      vhk936Total,
      vhk936Debt: vhk936Total - vhk936Total * fractionPaid,
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
