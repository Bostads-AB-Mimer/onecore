import ExcelJs from 'exceljs'
import { InvoicePaymentSummary } from '../types'

const DateFormat = 'yyyy-mm-dd'
const ColumnWidth = 20

type Row = {
  invoiceId: string
  invoiceDate: Date
  expirationDate: Date | undefined
  invoiceAmount: number
  paymentDate: Date
  amountPaid: number
  fractionPaid: number
  hemforTotal: number
  hemforPaid: number
  hyrsatTotal: number
  hyrsatPaid: number
  vhk906Total: number
  vhk906Paid: number
  vhk933Total: number
  vhk933Paid: number
  vhk934Total: number
  vhk934Paid: number
  vhk936Total: number
  vhk936Paid: number
}

export const convertInvoicePaymentSummariesToXlsx = async (
  summaries: InvoicePaymentSummary[]
) => {
  const workbook = new ExcelJs.Workbook()
  const worksheet = workbook.addWorksheet('Betalningar', {
    properties: {
      defaultColWidth: ColumnWidth,
    },
  })

  worksheet.columns = [
    { header: 'Fakturanummer', key: 'invoiceId' },
    {
      header: 'Fakturadatum',
      key: 'invoiceDate',
      style: { numFmt: DateFormat },
      width: ColumnWidth,
    },
    {
      header: 'Förfallodatum',
      key: 'expirationDate',
      style: { numFmt: DateFormat },
      width: ColumnWidth,
    },
    { header: 'Totalbelopp', key: 'invoiceAmount' },
    {
      header: 'Betaldatum',
      key: 'paymentDate',
      style: { numFmt: DateFormat },
      width: ColumnWidth,
    },
    { header: 'Betalt belopp', key: 'amountPaid' },
    { header: 'Andel betald', key: 'fractionPaid' },
    { header: 'Hemförsäkring totalbelopp', key: 'hemforTotal' },
    { header: 'Hemförsäkring betalt belopp', key: 'hemforPaid' },
    { header: 'Hyressättningsavgift totalbelopp', key: 'hyrsatTotal' },
    { header: 'Hyressättningsavgift betalt belopp', key: 'hyrsatPaid' },
    { header: 'VHK906 totalbelopp', key: 'vhk906Total' },
    { header: 'VHK906 betalt belopp', key: 'vhk906Paid' },
    { header: 'VHK933 totalbelopp', key: 'vhk933Total' },
    { header: 'VHK933 betalt belopp', key: 'vhk933Paid' },
    { header: 'VHK934 totalbelopp', key: 'vhk934Total' },
    { header: 'VHK934 betalt belopp', key: 'vhk934Paid' },
    { header: 'VHK936 totalbelopp', key: 'vhk936Total' },
    { header: 'VHK936 betalt belopp', key: 'vhk936Paid' },
  ]

  summaries.forEach((summary) => {
    worksheet.addRow(transformInvoicePaymentSummary(summary))
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

const transformInvoicePaymentSummary = (
  summary: InvoicePaymentSummary
): Row => {
  return {
    invoiceId: summary.invoiceId,
    invoiceDate: summary.invoiceDate,
    expirationDate: summary.expirationDate,
    invoiceAmount: summary.amount,
    paymentDate: summary.paymentDate,
    amountPaid: summary.amountPaid,
    fractionPaid: summary.fractionPaid,
    hemforTotal: summary.hemforTotal,
    hemforPaid: summary.hemforPaid,
    hyrsatTotal: summary.hyrsatTotal,
    hyrsatPaid: summary.hyrsatPaid,
    vhk906Total: summary.vhk906Total,
    vhk906Paid: summary.vhk906Paid,
    vhk933Total: summary.vhk933Total,
    vhk933Paid: summary.vhk933Paid,
    vhk934Total: summary.vhk934Total,
    vhk934Paid: summary.vhk934Paid,
    vhk936Total: summary.vhk936Total,
    vhk936Paid: summary.vhk936Paid,
  }
}
