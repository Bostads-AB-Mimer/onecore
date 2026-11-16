import ExcelJs from 'exceljs'
import { BosocialaObject, InvoicePaymentSummary } from '../types'
import { LeaseStatus, schemas } from '@onecore/types'
import {
  HOME_INSURANCE_LF_COLUMNS,
  toHomeInsuranceLfCells,
} from './home-insurance-columns'

const DateFormat = 'yyyy-mm-dd'
const ColumnWidth = 20

type PaymentRow = {
  invoiceId: string
  reference: string
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
    { header: 'Kundnummer', key: 'reference' },
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
    reference: summary.reference,
    invoiceDate: summary.invoiceDate,
    expirationDate: summary.expirationDate,
    invoiceAmount: summary.amount,
    remainingAmount: summary.paidAmount
      ? summary.amount - summary.paidAmount
      : summary.amount,
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

/**
 * A row of the unpaid invoice report (Bosociala), also used by the list of
 * open invoices so both files have the same columns.
 */
export type BosocialaRow = {
  invoiceId: string
  invoiceDate: Date | undefined
  expirationDate: Date | undefined
  invoiceAmount: number
  remainingAmount: number
  daysSinceExpirationDate: number | undefined
  rentalPropertyId: string
  tenantName: string
  tenantContactCode: string
  address: string
  leaseStatus: string
  costCentre: string | undefined
}

export const BOSOCIALA_COLUMNS: readonly {
  header: string
  key: keyof BosocialaRow
  width?: number
  style?: { numFmt: string }
}[] = [
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
  { header: 'Dagar sen förfallodatum', key: 'daysSinceExpirationDate' },
  { header: 'Objektsnummer', key: 'rentalPropertyId' },
  { header: 'Namn', key: 'tenantName' },
  { header: 'Kod', key: 'tenantContactCode' },
  { header: 'Adress', key: 'address' },
  { header: 'Status', key: 'leaseStatus' },
  { header: 'Kostnadsställe', key: 'costCentre' },
]

// The lease status as the unpaid invoice reports show it. An ended lease is
// shown as Uppsagt, as in Xpand's list, rather than Upphört.
export const REPORT_LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  [LeaseStatus.Current]: 'Gällande',
  [LeaseStatus.Upcoming]: 'Kommande',
  [LeaseStatus.AboutToEnd]: 'Uppsagt',
  [LeaseStatus.Ended]: 'Uppsagt',
  [LeaseStatus.PreliminaryTerminated]: 'Preliminärt uppsagt',
  [LeaseStatus.PendingSignature]: 'Väntar på signering',
  [LeaseStatus.NotSent]: 'Ej skickat',
}

export const convertBosocialaToXlsx = async (bosociala: BosocialaObject[]) => {
  const workbook = new ExcelJs.Workbook()
  const worksheet = workbook.addWorksheet('Bosociala', {
    properties: {
      defaultColWidth: ColumnWidth,
    },
  })

  worksheet.columns = [...BOSOCIALA_COLUMNS]

  bosociala.forEach((bo) => {
    worksheet.addRow(transformBosociala(bo))
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

const transformBosociala = (bosocial: BosocialaObject): BosocialaRow => {
  return {
    invoiceId: bosocial.invoiceId,
    invoiceDate: bosocial.invoiceDate,
    expirationDate: bosocial.expirationDate,
    invoiceAmount: bosocial.amount,
    remainingAmount: bosocial.paidAmount
      ? bosocial.amount - bosocial.paidAmount
      : bosocial.amount,
    costCentre: bosocial.costCentre,
    daysSinceExpirationDate: bosocial.daysSinceExpirationDate,
    rentalPropertyId: bosocial.lease?.rentalPropertyId ?? '',
    leaseStatus: bosocial.lease
      ? REPORT_LEASE_STATUS_LABELS[bosocial.lease.status]
      : '',
    tenantName: bosocial.contact?.fullName ?? '',
    tenantContactCode: bosocial.contact?.contactCode ?? '',
    address: bosocial.contact?.address?.street ?? '',
  }
}

const toDateString = (value: Date | null | undefined): string | null => {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export const convertHomeInsuranceToXlsx = async (
  rows: schemas.v1.HomeInsuranceExportRow[]
): Promise<Buffer> => {
  const workbook = new ExcelJs.Workbook()
  const worksheet = workbook.addWorksheet('Hemförsäkring', {
    properties: { defaultColWidth: ColumnWidth },
  })

  worksheet.addRow(HOME_INSURANCE_LF_COLUMNS.map((column) => column.header))

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.commit()

  rows.forEach((row) => {
    worksheet.addRow(
      toHomeInsuranceLfCells({
        leaseId: row.leaseId,
        nationalIdNumber: row.nationalIdNumber,
        fullName: row.fullName,
        address: row.address,
        postalCode: row.postalCode,
        city: row.city,
        numberOfRooms: row.numberOfRooms,
        squareMeters: row.squareMeters,
        leaseFromDate: toDateString(row.leaseFromDate),
        leaseToDate: toDateString(row.leaseToDate),
        phoneNumber: row.phoneNumber,
        email: row.email,
        rowFromDate: toDateString(row.rowFromDate),
        rowToDate: toDateString(row.rowToDate),
        // Misnamed in the export row: it holds the monthly amount.
        monthlyAmount: row.annualRent,
        rentalObjectCode: row.rentalObjectCode,
        leaseStatus: row.leaseStatus,
        articleText: row.articleText,
      })
    )
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
