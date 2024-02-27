import { Invoice, Invoices, UnpaidInvoice, UnpaidInvoices } from 'onecore-types'
import knex from 'knex'
import Config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.database,
})

function transformFromDbInvoice(row: any): Invoice {
  return {
    invoiceId: row.invoiceId.trim(),
    leaseId: row.leaseId.trim(),
    amount: row.amount,
    fromDate: row.fromDate,
    toDate: row.toDate,
    invoiceDate: row.invoiceDate,
    expirationDate: row.expirationDate,
    debitStatus: row.debitStatus,
    paymentStatus: row.paymentStatus,
    transactionTypeName: row.transactionTypeName.trim(),
  }
}

const getInvoicesByContactCode = async (
  contactKey: string
): Promise<Invoices | undefined> => {
  const rows = await db
    .select(
      'krfkh.invoice as invoiceId',
      'krfkh.reference as leaseId',
      'krfkh.amount as amount',
      'krfkh.fromdate as fromDate',
      'krfkh.todate as toDate',
      'krfkh.invdate as invoiceDate',
      'krfkh.expdate as expirationDate',
      'krfkh.debstatus as debitStatus',
      'krfkh.paystatus as paymentStatus',
      'revrt.name as transactionTypeName'
    )
    .from('krfkh')
    .innerJoin('cmctc', 'cmctc.keycmctc', 'krfkh.keycmctc')
    .innerJoin('revrt', 'revrt.keyrevrt', 'krfkh.keyrevrt')
    .where({ 'cmctc.cmctckod': contactKey })
    .orderBy('krfkh.fromdate', 'desc')
  if (rows && rows.length > 0) {
    const invoices: Invoice[] = rows.map(transformFromDbInvoice)

    if (invoices.length === 0) {
      return undefined
    }

    let unpaidInvoices = invoices.filter(
      (invoice: any) =>
        invoice.paymentStatus === 0 || invoice.paymentStatus === 1
    )
    const paidInvoices = invoices.filter(
      (invoice: any) => invoice.paymentStatus > 1
    )

    unpaidInvoices = unpaidInvoices.filter((unpaidInvoice) => {
      // If a paid invoice exists with the same invoice id and amount is 0, the invoice is considered paid (probably handled by debt collector)
      return !paidInvoices.some(
        (paidInvoice) =>
          paidInvoice.invoiceId === unpaidInvoice.invoiceId &&
          unpaidInvoice.amount === 0
      )
    })

    return {
      unpaidInvoices: unpaidInvoices,
      paidInvoices: paidInvoices,
    }
  }

  return undefined
}

const getUnpaidInvoicesByContactCode = async (
  contactKey: string
): Promise<UnpaidInvoices | undefined> => {
  const allInvoices = await getInvoicesByContactCode(contactKey)

  if (allInvoices?.unpaidInvoices == undefined) {
    return undefined
  }

  let accumulatedLastDebitDaysSinceToday = 0

  const unpaidInvoices: UnpaidInvoice[] | undefined =
    allInvoices?.unpaidInvoices.map((invoice: Invoice) => {
      const today = new Date()
      const daysSinceLastDebitDate = Math.floor(
        (today.getTime() - invoice.fromDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      accumulatedLastDebitDaysSinceToday += daysSinceLastDebitDate
      return {
        invoiceId: invoice.invoiceId,
        amount: invoice.amount,
        fromDate: invoice.fromDate,
        toDate: invoice.toDate,
        daysSinceLastDebitDate: daysSinceLastDebitDate,
      }
    })

  return {
    unpaidInvoices: unpaidInvoices,
    numberOfUnpaidInvoices: unpaidInvoices.length,
    accumulatedLastDebitDaysSinceToday: accumulatedLastDebitDaysSinceToday,
  }
}

export { getInvoicesByContactCode, getUnpaidInvoicesByContactCode }
