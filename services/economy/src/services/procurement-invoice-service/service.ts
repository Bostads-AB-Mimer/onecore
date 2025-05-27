import { getNewProcurementInvoiceRows } from '../../adapters/procurement-file-adapter'
import { enrichProcurementInvoiceRows } from '../../adapters/xpand-db-adapter'
import { InvoiceDataRow } from '../../common/types'

const createVoucherNumbers = (invoiceDataRows: InvoiceDataRow[]) => {
  let lastRow = invoiceDataRows[0]
  let chunkNumber = 1

  invoiceDataRows.forEach((invoiceDataRow: InvoiceDataRow) => {
    invoiceDataRow.voucherNo =
      '3' +
      '12345'.toString().padStart(5, '0') +
      chunkNumber.toString().padStart(3, '0')

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
      }

      lastRow = invoiceDataRow
    }
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
  const enrichedInvoiceRows = await enrichProcurementInvoiceRows(
    importedInvoiceRows.slice(0, 50)
  )
  const batchedInvoiceRows = await createVoucherNumbers(enrichedInvoiceRows)

  const csvLines = convertInvoiceRowsToCsv(batchedInvoiceRows)

  return csvLines
}
