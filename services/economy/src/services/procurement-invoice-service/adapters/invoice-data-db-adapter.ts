import knex from 'knex'
import config from '../../../common/config'

const db = knex({
  connection: {
    host: config.economyDatabase.host,
    user: config.economyDatabase.user,
    password: config.economyDatabase.password,
    port: config.economyDatabase.port,
    database: config.economyDatabase.database,
  },
  client: 'mssql',
})

const exportTable = 'procurement_invoice_export'

// MSSQL allows at most 2100 parameters per query
const whereInChunkSize = 1000
const insertChunkSize = 250

export type ExportedProcurementInvoice = {
  invoiceNumber: string
  voucherNo: string
  amount: number
}

export const closeDb = () => {
  db.destroy()
}

export const getCounterPartCustomers = async () => {
  const result = await db('invoice_counterpart')

  return result
}

/**
 * Returns the subset of the given invoice numbers that have already been
 * exported to Xledger.
 */
export const getExportedInvoiceNumbers = async (
  invoiceNumbers: string[]
): Promise<Set<string>> => {
  const exported = new Set<string>()

  for (let i = 0; i < invoiceNumbers.length; i += whereInChunkSize) {
    const rows: { InvoiceNumber: string }[] = await db(exportTable)
      .select('InvoiceNumber')
      .whereIn('InvoiceNumber', invoiceNumbers.slice(i, i + whereInChunkSize))

    rows.forEach((row) => exported.add(row.InvoiceNumber))
  }

  return exported
}

/**
 * Returns the highest exported voucher number that starts with the given
 * prefix, or undefined if there is none.
 */
export const getLastVoucherNumber = async (
  voucherPrefix: string
): Promise<string | undefined> => {
  const row = await db(exportTable)
    .where('VoucherNo', 'like', `${voucherPrefix}%`)
    .max({ maxVoucherNo: 'VoucherNo' })
    .first()

  return row?.maxVoucherNo ?? undefined
}

/**
 * Records the invoices as exported and runs the upload in the same
 * transaction. If the upload fails, the records are rolled back so the
 * invoices can be exported again. The unique index on InvoiceNumber makes a
 * concurrent run that tries to export the same invoices fail before it
 * uploads anything.
 */
export const recordExportedInvoices = async (
  invoices: ExportedProcurementInvoice[],
  exportedFilename: string,
  upload: () => Promise<void>
) => {
  await db.transaction(async (trx) => {
    await db
      .batchInsert(
        exportTable,
        invoices.map((invoice) => ({
          InvoiceNumber: invoice.invoiceNumber,
          VoucherNo: invoice.voucherNo,
          Amount: invoice.amount,
          ExportedFilename: exportedFilename,
        })),
        insertChunkSize
      )
      .transacting(trx)

    await upload()
  })
}
