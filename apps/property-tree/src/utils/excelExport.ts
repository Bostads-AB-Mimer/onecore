import ExcelJS from 'exceljs'

export interface ExcelColumn<T> {
  header: string
  key: string
  getValue: (item: T) => string | number | null
  width?: number
}

export async function exportToExcel<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string,
  sheetName = 'Data'
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 20,
  }))

  data.forEach((item) => {
    const row: Record<string, string | number | null> = {}
    columns.forEach((col) => {
      row[col.key] = col.getValue(item)
    })
    worksheet.addRow(row)
  })

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
