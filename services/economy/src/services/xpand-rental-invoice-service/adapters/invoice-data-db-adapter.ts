/**
 * Economy database tables used only by the legacy rental invoice import from
 * Xpand (import-rental-invoices): invoice_data holds the enriched invoice rows
 * of a batch and invoice_import_status the invoices already sent to Xledger.
 */
import knex, { Knex } from 'knex'
import { logger } from '@onecore/utilities'

import config from '@src/common/config'
import {
  CUSTOMER_LEDGER_ACCOUNT,
  InvoiceDataRow,
  TOTAL_ACCOUNT,
} from '@src/common/types'
import {
  findCounterPartCustomer,
  getCounterPartCustomers,
} from '@src/services/invoice-service/adapters/invoice-data-db-adapter'
import { InvoiceContract } from '../types'

const db = knex({
  connection: {
    host: config.economyDatabase.host,
    user: config.economyDatabase.user,
    password: config.economyDatabase.password,
    port: config.economyDatabase.port,
    database: config.economyDatabase.database,
  },
  pool: { min: 0, max: 10 },
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
}

const convertToDbRow = (row: InvoiceDataRow, batchId: string) => {
  return {
    batchId,
    contractCode: row.contractCode,
    contactCode: row.contactCode,
    tenantName: row.tenantName,
    invoiceDate: row.invoiceDate,
    invoiceFromDate: row.invoiceFromDate,
    invoiceToDate: row.invoiceToDate,
    invoiceDueDate: row.invoiceDueDate,
    rentArticle: row.rentArticle,
    invoiceRowText: row.invoiceRowText,
    amount: row.amount,
    vat: row.vat,
    totalAmount: row.totalAmount,
    account: row.account,
    costCode: row.costCode,
    property: row.property,
    projectCode: row.projectCode,
    freeCode: row.freeCode,
    invoiceNumber: row.invoiceNumber,
    // The invoice number is used as OCR for Xpand invoices
    oCR: row.invoiceNumber,
    ledgerAccount: row.ledgerAccount,
    totalAccount: row.totalAccount,
    invoiceTotalAmount: row.invoiceTotalAmount,
    counterPart: row.counterPart,
  }
}

/**
 * Saves the rows to invoice_data. A row that cannot be saved is logged and
 * skipped; verifyImport then fails the batch since its invoice is missing.
 */
export const saveInvoiceRows = async (
  rows: InvoiceDataRow[],
  batchId: string
) => {
  for (const row of rows) {
    const dbRow = convertToDbRow(row, batchId)
    try {
      await db('invoice_data').insert(dbRow)
    } catch (err: unknown) {
      logger.error(
        {
          err,
          contractCode: dbRow['contractCode'],
          article: dbRow['rentArticle'],
          invoiceNumber: dbRow['invoiceNumber'],
        },
        'xpand-rental-invoice-data-db-adapter.saveInvoiceRows'
      )
    }
  }
}

/**
 * Gets all invoices for a batch, sorted by invoice from date
 * and to date to group periods later.
 */
export const getInvoicesByChunks = async (
  batchId: string
): Promise<InvoiceContract[]> => {
  try {
    return await db('invoice_data')
      .select(
        'invoiceNumber',
        'invoiceFromDate',
        'invoiceToDate',
        'ledgerAccount',
        'totalAccount',
        'counterPart'
      )
      .distinct()
      .where('batchId', batchId)
      .whereNull('importStatus')
      .orderBy([
        'invoiceFromDate',
        'invoiceToDate',
        'ledgerAccount',
        'totalAccount',
        'counterPart',
      ])
  } catch (err: unknown) {
    logger.error(
      { err },
      'xpand-rental-invoice-data-db-adapter.getInvoicesByChunks'
    )
    throw err
  }
}

export const getAggregatedInvoiceRows = async (
  batchId: string,
  invoiceNumbers: string[]
): Promise<InvoiceDataRow[]> => {
  const columns = [
    'RentArticle',
    'Account',
    'CostCode',
    'Property',
    'ProjectCode',
    'FreeCode',
    'InvoiceDate',
    'InvoiceDueDate',
    'InvoiceFromDate',
    'InvoiceToDate',
    'BatchId',
    'TotalAccount',
    'CounterPart',
  ]

  try {
    return await db('invoice_data')
      .sum({ totalAmount: 'TotalAmount', totalVat: 'VAT' })
      .select(columns)
      .groupBy(columns)
      .where('batchId', batchId)
      .whereIn('InvoiceNumber', invoiceNumbers)
  } catch (err: unknown) {
    logger.error(
      { err },
      'xpand-rental-invoice-data-db-adapter.getAggregatedInvoiceRows'
    )
    throw err
  }
}

/**
 * Sets the customer ledger account and total account of each row, from the
 * counterpart customer when the tenant is one. Round off rows already have
 * their accounts.
 */
export const addAccountInformation = async (
  invoiceDataRows: InvoiceDataRow[]
): Promise<InvoiceDataRow[]> => {
  const counterPartCustomers = await getCounterPartCustomers()

  for (const row of invoiceDataRows) {
    if ('Öresutjämning'.localeCompare(row.invoiceRowText as string) !== 0) {
      const counterPart = findCounterPartCustomer(
        counterPartCustomers,
        row.tenantName?.toString()
      )

      if (counterPart) {
        row.ledgerAccount = counterPart.ledgerAccount
        row.totalAccount = counterPart.totalAccount
      } else {
        row.ledgerAccount = CUSTOMER_LEDGER_ACCOUNT
        row.totalAccount = TOTAL_ACCOUNT
      }
    }
  }

  return invoiceDataRows
}

/**
 * Records the invoices of the batch in invoice_import_status so they are not
 * imported again.
 */
export const markInvoicesAsImported = async (batchId: number) => {
  try {
    await db
      .into(
        db.raw('?? (??, ??, ??, ??)', [
          'invoice_import_status',
          'InvoiceType',
          'ImportedDate',
          'InvoiceNumber',
          'Amount',
        ])
      )
      .insert((query: Knex.QueryBuilder) => {
        query
          .select(
            { InvoiceType: db.raw("'invoice'") },
            { ImportedDate: db.raw('GETDATE()') },
            'InvoiceNumber'
          )
          .sum({ Amount: 'TotalAmount' })
          .from('invoice_data')
          .where('BatchId', batchId)
          .groupBy('InvoiceNumber')
      })
  } catch (err: unknown) {
    logger.error(
      { err },
      'xpand-rental-invoice-data-db-adapter.markInvoicesAsImported'
    )
    throw err
  }
}

export const getImportedInvoiceNumbers = async (): Promise<string[]> => {
  try {
    const invoiceNumbers: { InvoiceNumber: string }[] = await db(
      'invoice_import_status'
    )
      .select('InvoiceNumber')
      .where('InvoiceType', 'invoice')

    return invoiceNumbers.map((invoice) => invoice.InvoiceNumber)
  } catch (err: unknown) {
    logger.error(
      { err },
      'xpand-rental-invoice-data-db-adapter.getImportedInvoiceNumbers'
    )
    throw err
  }
}

export const getAllInvoiceRows = async (
  batchId: string
): Promise<InvoiceDataRow[]> => {
  try {
    return await db('invoice_data')
      .where('batchId', batchId)
      .orderBy('InvoiceDate', 'ASC')
      .orderBy('LedgerAccount', 'ASC')
      .orderBy('InvoiceNumber', 'ASC')
  } catch (err: unknown) {
    logger.error(
      { err },
      'xpand-rental-invoice-data-db-adapter.getAllInvoiceRows'
    )
    throw err
  }
}

/**
 * Verifies that every invoice selected for import has rows in the batch.
 * Throws if any invoice is missing.
 */
export const verifyImport = async (
  invoicesToImport: string[],
  batchId: string,
  xpandBatchTotal: number
) => {
  let importedInvoiceNumbers: string[]
  let batchTotalAmount: number

  try {
    importedInvoiceNumbers = (
      await db('invoice_data')
        .select('InvoiceNumber')
        .distinct()
        .where('batchId', batchId)
    ).map((invoice: { InvoiceNumber: string }) => invoice.InvoiceNumber)

    const batchTotalAmountResult: { batchTotalAmount: number | null }[] =
      await db.raw(
        'SELECT SUM(TotalAmount) AS batchTotalAmount FROM invoice_data where batchId = ?',
        [batchId]
      )
    batchTotalAmount = batchTotalAmountResult[0]?.batchTotalAmount ?? 0
  } catch (err: unknown) {
    logger.error({ err }, 'xpand-rental-invoice-data-db-adapter.verifyImport')
    throw err
  }

  const missedInvoices = invoicesToImport.filter(
    (rentalInvoiceNumber: string) =>
      !importedInvoiceNumbers.includes(rentalInvoiceNumber)
  )

  if (missedInvoices.length > 0) {
    logger.error(
      { missedInvoices },
      'Invoices that were selected for import were not imported'
    )
    throw new Error('Invoices that were selected for import were not imported')
  }

  // The Xpand total also includes the invoices that were left out of the
  // batch because of errors, so a difference is expected when there are
  // errors. Logged for follow-up rather than failing the batch.
  // The Xpand total counts debit invoices (type 2) as positive while their
  // rows in the batch are negative, so the totals match with opposite signs.
  const batchTotalDiff = Math.abs(xpandBatchTotal + batchTotalAmount)
  if (batchTotalDiff > 1) {
    logger.warn(
      { batchId, batchTotalAmount, xpandTotalAmount: xpandBatchTotal },
      'Xpand total amount does not match batch row totals'
    )
  }
}

export const getBatchAccountTotals = async (
  batchId: string
): Promise<Record<string, number>> => {
  try {
    const accountResult: { account: string; accountSum: number }[] =
      await db.raw(
        'select account, sum(totalamount) as accountSum from invoice_data \
      where batchId = ? \
      group by account \
      order by account',
        [batchId]
      )

    const accountTotals: Record<string, number> = {}

    accountResult.forEach((account) => {
      accountTotals[account.account] = account.accountSum
    })

    return accountTotals
  } catch (err: unknown) {
    logger.error(
      { err },
      'xpand-rental-invoice-data-db-adapter.getBatchAccountTotals'
    )
    throw err
  }
}
