import { getNewProcurementInvoiceRows } from './adapters/procurement-file-adapter'
import {
  enrichProcurementInvoiceRows,
  closeDb as closeXpandDb,
} from './adapters/xpand-db-adapter'
import {
  getCounterPartCustomers,
  getExportedInvoiceNumbers,
  getLastVoucherNumber,
  closeDb as closeInvoiceDb,
  ExportedProcurementInvoice,
} from './adapters/invoice-data-db-adapter'
import { InvoiceDataRow } from '../../common/types'
import { logger } from '@onecore/utilities'

const ledgerAccount = '2460'
const maxChunkNumber = 999

/**
 * Voucher number prefix for the given date: '3' + two-digit year + three-digit
 * day of year, e.g. 326279 for 2026-10-06.
 */
export const getVoucherPrefix = (date: Date = new Date()) => {
  const year = date.getFullYear()
  const dayOfYear =
    (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 0)) /
    (24 * 60 * 60 * 1000)

  return (
    '3' +
    (year % 100).toString().padStart(2, '0') +
    dayOfYear.toString().padStart(3, '0')
  )
}

/**
 * The first chunk number to use for vouchers with the given prefix, continuing
 * after the vouchers already exported on the same day.
 */
export const getFirstChunkNumber = async (voucherPrefix: string) => {
  const lastVoucherNo = await getLastVoucherNumber(voucherPrefix)
  if (!lastVoucherNo) return 1

  const lastChunkNumber = parseInt(lastVoucherNo.slice(voucherPrefix.length))
  return Number.isNaN(lastChunkNumber) ? 1 : lastChunkNumber + 1
}

export const createVoucherNumbers = (
  invoiceDataRows: InvoiceDataRow[],
  voucherPrefix: string,
  firstChunkNumber = 1
) => {
  let lastRow = invoiceDataRows[0]
  let chunkNumber = firstChunkNumber
  const chunkSize = 500
  let currentChunkSize = 0

  invoiceDataRows.forEach((invoiceDataRow: InvoiceDataRow) => {
    if (
      (invoiceDataRow.invoiceDate as string).localeCompare(
        lastRow.invoiceDate as string
      ) !== 0
    ) {
      const diff = (invoiceDataRow.invoiceDate as string).localeCompare(
        lastRow.invoiceDate as string
      )

      if (diff) {
        chunkNumber++
        currentChunkSize = 0
      }
    } else if (
      invoiceDataRow.invoiceNumber !== lastRow.invoiceNumber &&
      currentChunkSize > chunkSize
    ) {
      chunkNumber++
      currentChunkSize = 0
    }

    lastRow = invoiceDataRow
    currentChunkSize++

    if (chunkNumber > maxChunkNumber) {
      throw new Error(
        `Voucher numbers for ${voucherPrefix} exhausted (more than ${maxChunkNumber} vouchers in one day)`
      )
    }

    invoiceDataRow.voucherNo =
      voucherPrefix + chunkNumber.toString().padStart(3, '0')
  })

  return invoiceDataRows
}

/**
 * One entry per invoice with its voucher number and the amount posted to the
 * supplier ledger account.
 */
export const summarizeExportedInvoices = (
  invoiceDataRows: InvoiceDataRow[]
): ExportedProcurementInvoice[] => {
  const invoices = new Map<string, ExportedProcurementInvoice>()

  for (const row of invoiceDataRows) {
    const invoiceNumber = String(row.invoiceNumber)
    const invoice = invoices.get(invoiceNumber) ?? {
      invoiceNumber,
      voucherNo: String(row.voucherNo),
      amount: 0,
    }
    if (row.account === ledgerAccount) {
      invoice.amount += Number(row.totalAmount)
    }
    invoices.set(invoiceNumber, invoice)
  }

  return [...invoices.values()]
}

/**
 * Removes rows for invoices that have already been exported to Xledger.
 */
export const removeAlreadyExportedInvoices = async (
  invoiceDataRows: InvoiceDataRow[]
) => {
  const invoiceNumbers = [
    ...new Set(invoiceDataRows.map((row) => String(row.invoiceNumber))),
  ]
  const exported = await getExportedInvoiceNumbers(invoiceNumbers)

  return {
    rows: invoiceDataRows.filter(
      (row) => !exported.has(String(row.invoiceNumber))
    ),
    alreadyExported: invoiceNumbers.filter((number) => exported.has(number)),
  }
}

const convertInvoiceRowsToCsv = async (invoiceDataRows: InvoiceDataRow[]) => {
  const counterPartCode = (await getCounterPartCustomers()).find((customer) => {
    return customer.CustomerName === 'Mälarenergi'
  })?.CounterpartCode

  const csvHeader =
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'

  const csvLines = invoiceDataRows.map((invoiceDataRow: InvoiceDataRow) => {
    return `MA;${invoiceDataRow.voucherNo};${(invoiceDataRow.invoiceDate as string).replaceAll('-', '')};${invoiceDataRow.account};${invoiceDataRow.costCode ?? ''};${invoiceDataRow.projectCode ?? ''};${invoiceDataRow.propertyCode ?? ''};${invoiceDataRow.freeCode ?? ''};${counterPartCode};${invoiceDataRow.periodStart};${invoiceDataRow.numPeriods};${invoiceDataRow.subledgerNumber};${(invoiceDataRow.invoiceDate as string).replaceAll('-', '')};${invoiceDataRow.invoiceNumber};${invoiceDataRow.invoiceNumber};${(invoiceDataRow.dueDate as string).replaceAll('-', '')};${invoiceDataRow.invoiceNumber};${invoiceDataRow.vatCode || ''};${invoiceDataRow.totalAmount}`
  })

  return [csvHeader, ...csvLines]
}

export type ImportResult = {
  /** XML files downloaded and processed in this run */
  filenames: string[]
  /** Invoices skipped because they were exported in an earlier run */
  alreadyExported: string[]
  /** Invoices included in csvLines */
  exportedInvoices: ExportedProcurementInvoice[]
  errors: Record<string, string> | null
  csvLines: string[] | null
}

export const importNewFiles = async (): Promise<ImportResult> => {
  const { rows: importedInvoiceRows, filenames } =
    await getNewProcurementInvoiceRows()
  logger.info(
    { rows: importedInvoiceRows.length },
    'Read invoice rows from files'
  )

  if (importedInvoiceRows.length === 0) {
    return {
      filenames,
      alreadyExported: [],
      exportedInvoices: [],
      errors: null,
      csvLines: null,
    }
  }

  const { rows: newInvoiceRows, alreadyExported } =
    await removeAlreadyExportedInvoices(importedInvoiceRows)

  if (alreadyExported.length > 0) {
    logger.warn(
      { alreadyExported },
      'Skipping invoices that have already been exported'
    )
  }

  if (newInvoiceRows.length === 0) {
    return {
      filenames,
      alreadyExported,
      exportedInvoices: [],
      errors: null,
      csvLines: null,
    }
  }

  const enrichedInvoiceRows = await enrichProcurementInvoiceRows(newInvoiceRows)

  logger.info({ rows: newInvoiceRows.length }, 'Enriched invoice rows')
  const voucherPrefix = getVoucherPrefix()
  const batchedInvoiceRows = createVoucherNumbers(
    enrichedInvoiceRows.rows,
    voucherPrefix,
    await getFirstChunkNumber(voucherPrefix)
  )

  if (enrichedInvoiceRows.missingFacilities) {
    logger.error(
      { missingFacilities: enrichedInvoiceRows.missingFacilities },
      'Missing facilities'
    )
  }

  const csvLines = await convertInvoiceRowsToCsv(batchedInvoiceRows)

  return {
    filenames,
    alreadyExported,
    exportedInvoices: summarizeExportedInvoices(batchedInvoiceRows),
    errors: enrichedInvoiceRows.missingFacilities,
    csvLines,
  }
}

export const closeDatabases = () => {
  closeXpandDb()
  closeInvoiceDb()
}
