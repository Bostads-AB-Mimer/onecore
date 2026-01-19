import { Workbook, ValueType, Cell } from 'exceljs'
import { createReadStream } from 'fs'
import { columnNames, InvoiceDataRow } from '../../../common/types/legacyTypes'

const getCellValue = (cell: Cell): string | number => {
  if (cell.type === ValueType.Date) {
    const dateval = cell.value as Date
    const cellValue = dateval.toISOString().split('T')[0]
    return cellValue
  } else if (cell.type === ValueType.Number) {
    return cell.value as number
  } else {
    return cell.value ? cell.value.toString() : ' '
  }
}

export const excelFileToInvoiceDataRows = async (
  invoiceRowsExcelFileName: string
) => {
  const excelDataStream = await createReadStream(invoiceRowsExcelFileName)
  const workbook = new Workbook()
  await workbook.xlsx.read(excelDataStream)
  const rowCount = workbook.worksheets[0].rowCount
  const rows = workbook.worksheets[0].getRows(2, rowCount)
  const invoiceRows: InvoiceDataRow[] = []

  if (rows) {
    for (const row of rows) {
      const currentRow: InvoiceDataRow = {}

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const columnName = columnNames[colNumber - 1]
        const cellValue = getCellValue(cell)

        currentRow[columnName] = cellValue
      })

      // Skip invoice summation rows
      if (
        currentRow.rentArticle &&
        (currentRow.rentArticle as string).trimEnd() &&
        'HYRA'.localeCompare(currentRow.transactionType as string) === 0
      ) {
        invoiceRows.push(currentRow)
      }
    }
  }

  excelDataStream.destroy()

  return invoiceRows
}
