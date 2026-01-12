import ExcelJs from 'exceljs'
import { InvoicePaymentSummary } from '../types'

const DateFormat = 'yyyy-mm-dd'
const ColumnWidth = 20

type PaymentRow = {
  invoiceId: string
  invoiceDate: Date
  expirationDate: Date | undefined
  invoiceAmount: number
  remainingAmount: number
  fractionPaid: number
  hemforTotal: number
  hemforDebt: number
  hyrsatTotal: number
  hyrsatDebt: number
  vhk906Total: number
  vhk906Debt: number
  vhk933Total: number
  vhk933Debt: number
  vhk934Total: number
  vhk934Debt: number
  vhk936Total: number
  vhk936Debt: number
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
      header: 'Skuld',
      key: 'remainingAmount',
      width: ColumnWidth,
    },
    { header: 'Andel betald', key: 'fractionPaid' },
    { header: 'Hemförsäkring totalbelopp', key: 'hemforTotal' },
    { header: 'Hemförsäkring skuld', key: 'hemforDebt' },
    { header: 'Hyressättningsavgift totalbelopp', key: 'hyrsatTotal' },
    { header: 'Hyressättningsavgift skuld', key: 'hyrsatDebt' },
    { header: 'VHK906 totalbelopp', key: 'vhk906Total' },
    { header: 'VHK906 skuld', key: 'vhk906Debt' },
    { header: 'VHK933 totalbelopp', key: 'vhk933Total' },
    { header: 'VHK933 skuld', key: 'vhk933Debt' },
    { header: 'VHK934 totalbelopp', key: 'vhk934Total' },
    { header: 'VHK934 skuld', key: 'vhk934Debt' },
    { header: 'VHK936 totalbelopp', key: 'vhk936Total' },
    { header: 'VHK936 skuld', key: 'vhk936Debt' },
  ]

  summaries.forEach((summary) => {
    worksheet.addRow(transformInvoicePaymentSummary(summary))
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

const transformInvoicePaymentSummary = (
  summary: InvoicePaymentSummary
): PaymentRow => {
  return {
    invoiceId: summary.invoiceId,
    invoiceDate: summary.invoiceDate,
    expirationDate: summary.expirationDate,
    invoiceAmount: summary.amount,
    remainingAmount: summary.paidAmount
      ? summary.amount - summary.paidAmount
      : 0,
    fractionPaid: summary.fractionPaid,
    hemforTotal: summary.hemforTotal,
    hemforDebt: summary.hemforDebt,
    hyrsatTotal: summary.hyrsatTotal,
    hyrsatDebt: summary.hyrsatDebt,
    vhk906Total: summary.vhk906Total,
    vhk906Debt: summary.vhk906Debt,
    vhk933Total: summary.vhk933Total,
    vhk933Debt: summary.vhk933Debt,
    vhk934Total: summary.vhk934Total,
    vhk934Debt: summary.vhk934Debt,
    vhk936Total: summary.vhk936Total,
    vhk936Debt: summary.vhk936Debt,
  }
}
