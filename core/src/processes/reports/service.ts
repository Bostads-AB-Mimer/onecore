import assert from 'node:assert'
import { BosocialaObject, InvoicePaymentSummary } from './types'

import { logger } from '@onecore/utilities'
import * as economyAdapter from '../../adapters/economy-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import { Lease, RentInvoiceRow } from '@onecore/types'
import dayjs from 'dayjs'

export const getUnpaidInvoicePaymentSummaries = async (
  from?: Date,
  to?: Date
) => {
  logger.info('Getting unpaid invoices')
  const unpaidInvoices = await economyAdapter.getInvoices({
    from,
    to,
    remainingAmountGreaterThan: 0,
  })

  if (!unpaidInvoices.ok) {
    throw new Error('Failed to fetch unpaid invoices')
  }

  logger.info(`Got ${unpaidInvoices.data.length} invoices`)

  const unpaidRentInvoices = unpaidInvoices.data.filter(
    (i) => i.invoiceId.startsWith('55') // Rent invoice numbers start with 55
  )
  logger.info(`${unpaidRentInvoices.length} unpaid rent invoices`)

  logger.info('Getting invoice rows')

  const allInvoiceRows = await economyAdapter.getRentInvoiceRows(
    unpaidRentInvoices.map((i) => i.invoiceId)
  )

  if (!allInvoiceRows.ok) {
    throw new Error('Failed to fetch invoice rows')
  }

  logger.info(`Got ${allInvoiceRows.data.length} invoice rows`)

  const filteredInvoiceRows = allInvoiceRows.data.filter(
    (r) =>
      r.code?.startsWith('HEMFÖR') ||
      r.code?.startsWith('HYRSÄT') ||
      r.code?.startsWith('VHK')
  )

  const invoicePaymentSummaries: InvoicePaymentSummary[] = []

  unpaidRentInvoices.forEach((i) => {
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

    const hemforTotal = sumRows(invoiceRowsForInvoice, (code) =>
      code.startsWith('HEMFÖR')
    )
    const hyrsatTotal = sumRows(invoiceRowsForInvoice, (code) =>
      code.startsWith('HYRSÄT')
    )
    const vhk906Total = sumRows(
      invoiceRowsForInvoice,
      (code) => code === 'VHK906'
    )
    const vhk933Total = sumRows(
      invoiceRowsForInvoice,
      (code) => code === 'VHK933'
    )
    const vhk934Total = sumRows(
      invoiceRowsForInvoice,
      (code) => code === 'VHK934'
    )
    const vhk936Total = sumRows(
      invoiceRowsForInvoice,
      (code) => code === 'VHK936'
    )

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

// An invoice can have the same code on several rows, e.g. HEMFÖR for two
// periods or after a change of insurance, so all of them count.
const sumRows = (
  rows: RentInvoiceRow[],
  matchesCode: (code: string) => boolean
) =>
  rows
    .filter((r) => r.code && matchesCode(r.code))
    .reduce((total, r) => total + r.amount + r.reduction + r.vat, 0)

export const getBosociala = async (): Promise<BosocialaObject[]> => {
  const now = new Date()

  // Get ALL unpaid invoices
  const invoicesResult = await economyAdapter.getInvoices({
    remainingAmountGreaterThan: 0,
  })
  if (!invoicesResult.ok) {
    throw new Error()
  }

  const expiredUnpaidInvoices = invoicesResult.data.filter(
    (i) => i.expirationDate && new Date(i.expirationDate) < now
  )

  const allLeaseDetailsResult = await economyAdapter.getLeaseDetailsForInvoices(
    expiredUnpaidInvoices
      .filter((i) => i.type === 'Regular')
      .map((i) => i.invoiceId)
  )
  if (!allLeaseDetailsResult.ok) {
    throw new Error()
  }

  const allLeaseDetails = allLeaseDetailsResult.data
  const [allLeases, allContacts] = await Promise.all([
    leasingAdapter.getLeasesBatch(
      allLeaseDetails
        .map((ld) => ld.details[0]?.leaseId)
        .filter((leaseId) => leaseId !== undefined)
    ),
    leasingAdapter.getContacts(expiredUnpaidInvoices.map((i) => i.reference)),
  ])

  const all: BosocialaObject[] = []
  for (const i of expiredUnpaidInvoices) {
    const daysSinceExpirationDate = dayjs(now).diff(
      dayjs(i.expirationDate),
      'days'
    )
    const contact = allContacts.find((c) => c.contactCode === i.reference)
    let lease: Lease | undefined = undefined
    let costCentre = i.costCentre

    if (i.type === 'Regular') {
      const leaseDetailsForInvoice = allLeaseDetails.find(
        (ld) => ld.invoiceId === i.invoiceId
      )
      const mainLeaseDetails = leaseDetailsForInvoice?.details[0] // Assume that the first row is for the main lease

      if (mainLeaseDetails) {
        lease = allLeases.find((l) => l.leaseId === mainLeaseDetails.leaseId)
        // Keep Xledger's cost centre when the lease's isn't known
        costCentre = mainLeaseDetails.costCentre ?? costCentre
      }
    }

    all.push({
      ...i,
      invoiceDate: new Date(i.invoiceDate),
      expirationDate: i.expirationDate ? new Date(i.expirationDate) : undefined,
      lease,
      contact,
      daysSinceExpirationDate,
      costCentre,
    })
  }

  return all
}
