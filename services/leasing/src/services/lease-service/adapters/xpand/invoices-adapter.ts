import {
  Invoice,
  InvoiceTransactionType,
  PaymentStatus,
  invoiceTransactionTypeTranslation,
  paymentStatusTranslation,
} from '@onecore/types'
import { logger } from '@onecore/utilities'
import { xpandDb } from './xpandDb'

const getTransactionType = (transactionTypeString: any) => {
  if (!transactionTypeString || !(typeof transactionTypeString == 'string')) {
    return InvoiceTransactionType.Other
  }

  let transactionType =
    invoiceTransactionTypeTranslation[transactionTypeString.trimEnd()]

  if (!transactionType) {
    transactionType = InvoiceTransactionType.Other
  }

  return transactionType
}

const getPaymentStatus = (paymentStatusNumber: number) => {
  const paymentStatus = paymentStatusTranslation[paymentStatusNumber]

  return paymentStatus
}

function transformFromDbInvoice(row: any, contactCode: string): Invoice {
  return {
    invoiceId: row.invoiceId.trim(),
    leaseId: row.leaseId?.trim(),
    reference: contactCode,
    amount: row.amount,
    fromDate: row.fromDate,
    toDate: row.toDate,
    invoiceDate: row.invoiceDate,
    expirationDate: row.expirationDate,
    debitStatus: row.debitStatus,
    paymentStatus: getPaymentStatus(row.paymentStatus),
    transactionType: getTransactionType(row.transactionType),
    transactionTypeName: row.transactionTypeName.trim(),
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  }
}

const getInvoicesByContactCode = async (
  contactCode: string
): Promise<Invoice[] | undefined> => {
  logger.info({ contactCode }, 'Getting invoices by contact code from Xpand DB')
  const rows = await xpandDb
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
      'krfkh.keyrevrt as transactionType',
      'revrt.name as transactionTypeName'
    )
    .from('krfkh')
    .innerJoin('cmctc', 'cmctc.keycmctc', 'krfkh.keycmctc')
    .innerJoin('revrt', 'revrt.keyrevrt', 'krfkh.keyrevrt')
    .where({ 'cmctc.cmctckod': contactCode })
    .orderBy('krfkh.fromdate', 'desc')
  if (rows && rows.length > 0) {
    const invoices: Invoice[] = rows
      .filter((row) => {
        // Only include invoices with invoiceIds
        // that have not been deleted (debitStatus 6 = makulerad)
        if (row.invoiceId && row.debitStatus !== 6) {
          return true
        } else {
          return false
        }
      })
      .map((row) => transformFromDbInvoice(row, contactCode))
    logger.info(
      { contactCode },
      'Getting invoices by contact code from Xpand DB completed'
    )
    return invoices
  }

  logger.info(
    { contactCode },
    'Getting invoices by contact code from Xpand DB completed - no invoices found'
  )
  return undefined
}

const getUnpaidInvoicesByContactCode = async (
  contactKey: string
): Promise<Invoice[] | undefined> => {
  const allInvoices = await getInvoicesByContactCode(contactKey)

  const unpaidInvoices = allInvoices?.filter((invoice: Invoice) => {
    return invoice.paymentStatus === PaymentStatus.Unpaid
  })

  return unpaidInvoices
}

export { getInvoicesByContactCode, getUnpaidInvoicesByContactCode }
