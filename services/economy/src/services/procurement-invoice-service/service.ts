import { getNewProcurementInvoiceRows } from './adapters/procurement-file-adapter'
import { enrichProcurementInvoiceRows } from './adapters/xpand-db-adapter'
import { InvoiceDataRow } from '../../common/types'

const createVoucherNumbers = (invoiceDataRows: InvoiceDataRow[]) => {
  let lastRow = invoiceDataRows[0]
  let chunkNumber = 1
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

    const date = new Date()
    let uniquePart = date.toISOString().substring(2, 4)
    uniquePart +=
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
        Date.UTC(date.getFullYear(), 0, 0)) /
      24 /
      60 /
      60 /
      1000

    invoiceDataRow.voucherNo =
      '3' +
      uniquePart.toString().padStart(5, '0') +
      chunkNumber.toString().padStart(3, '0')
  })

  return invoiceDataRows
}

const convertInvoiceRowsToCsv = async (invoiceDataRows: InvoiceDataRow[]) => {
  const csvHeader =
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'

  const csvLines = invoiceDataRows.map((invoiceDataRow: InvoiceDataRow) => {
    return `GL;${invoiceDataRow.voucherNo};${(invoiceDataRow.invoiceDate as string).replaceAll('-', '')};${invoiceDataRow.account};${invoiceDataRow.costCode ?? ''};${invoiceDataRow.projectCode ?? ''};${invoiceDataRow.propertyCode ?? ''};${invoiceDataRow.freeCode ?? ''};;${invoiceDataRow.periodStart};${invoiceDataRow.numPeriods};${invoiceDataRow.subledgerNumber};${(invoiceDataRow.invoiceDate as string).replaceAll('-', '')};${invoiceDataRow.invoiceNumber};${invoiceDataRow.invoiceNumber};${(invoiceDataRow.dueDate as string).replaceAll('-', '')};;${invoiceDataRow.vatCode || ''};${invoiceDataRow.totalAmount}`
  })

  return [csvHeader, ...csvLines]
}

export const importNewFiles = async () => {
  const importedInvoiceRows = await getNewProcurementInvoiceRows()
  const enrichedInvoiceRows =
    await enrichProcurementInvoiceRows(importedInvoiceRows)
  const batchedInvoiceRows = await createVoucherNumbers(
    enrichedInvoiceRows.rows
  )

  if (enrichedInvoiceRows.missingFacilities) {
    console.log('Missing facilities', enrichedInvoiceRows.missingFacilities)
  }

  const csvLines = convertInvoiceRowsToCsv(batchedInvoiceRows)

  return csvLines
}
