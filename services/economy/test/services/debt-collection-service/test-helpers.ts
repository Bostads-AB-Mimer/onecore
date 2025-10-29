// Test utilities and fixtures for debt collection tests

export const createCsvContent = (
  headers: string[],
  rows: string[][],
  separator = ';'
): string => {
  const headerLine = headers.join(separator)
  const rowLines = rows.map((row) => row.join(separator))
  return [headerLine, ...rowLines].join('\n')
}

export const createRentInvoiceCsv = (
  rows: Array<{
    contactCode: string
    invoiceNumber: string
    invoiceDate: string
    expiryDate: string
    totalAmount: string
    remainingAmount: string
    comment?: string
  }>
) => {
  const headers = [
    'contactCode',
    'invoiceNumber',
    'invoiceDate',
    'expiryDate',
    'totalAmount',
    'remainingAmount',
    'comment',
  ]
  const dataRows = rows.map((row) => [
    row.contactCode,
    row.invoiceNumber,
    row.invoiceDate,
    row.expiryDate,
    row.totalAmount,
    row.remainingAmount,
    row.comment || '',
  ])
  return createCsvContent(headers, dataRows)
}

export const createBalanceCorrectionCsv = (
  rows: Array<{
    contactCode: string
    type: string
    invoiceNumber: string
    date: string
    paidAmount: string
    remainingAmount: string
  }>
) => {
  const headers = [
    'contactCode',
    'type',
    'invoiceNumber',
    'date',
    'paidAmount',
    'remainingAmount',
  ]
  const dataRows = rows.map((row) => [
    row.contactCode,
    row.type,
    row.invoiceNumber,
    row.date,
    row.paidAmount,
    row.remainingAmount,
  ])
  return createCsvContent(headers, dataRows)
}

export const sampleRentInvoiceData = {
  contactCode: 'CONTACT001',
  invoiceNumber: 'INV001',
  invoiceDate: '2023-01-01',
  expiryDate: '2023-01-31',
  totalAmount: '5000',
  remainingAmount: '3000',
  comment: 'Test comment',
}

export const sampleBalanceCorrectionData = {
  contactCode: 'CONTACT001',
  type: 'Payment',
  invoiceNumber: 'INV001',
  date: '2023-01-01',
  paidAmount: '2000',
  remainingAmount: '3000',
}

export const invalidCsvExamples = {
  missingColumns: 'contactCode;invoiceNumber\nCONTACT001',
  extraColumns:
    'contactCode;invoiceNumber;extra\nCONTACT001;INV001;EXTRA;TOOMANY',
  invalidDate:
    'contactCode;invoiceNumber;invoiceDate;expiryDate;totalAmount;remainingAmount\nCONTACT001;INV001;invalid-date;2023-01-31;5000;3000',
  invalidNumber:
    'contactCode;invoiceNumber;invoiceDate;expiryDate;totalAmount;remainingAmount\nCONTACT001;INV001;2023-01-01;2023-01-31;not-a-number;3000',
}
