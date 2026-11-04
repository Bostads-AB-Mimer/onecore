import { economy } from '@onecore/types'

import { ImportInvoicesError } from '../adapters/economy-adapter'

export type CompanyExportReport = {
  companyId: string
  exportedCount: number
  skippedCount: number
  // Invoices left out of the export. The same invoice comes back in every
  // batch until it is fixed, so this is keyed to keep one entry per problem.
  errors: Map<string, economy.RentalInvoiceExportError>
  markFailures: economy.MarkInvoiceAsExportedFailure[]
  // Set when the run for the company stopped before all batches were done.
  failure?: { err: ImportInvoicesError; detail?: string }
}

export const createCompanyExportReport = (
  companyId: string
): CompanyExportReport => ({
  companyId,
  exportedCount: 0,
  skippedCount: 0,
  errors: new Map(),
  markFailures: [],
})

export const addBatchToReport = (
  report: CompanyExportReport,
  batch: economy.ImportInvoicesResponse
): void => {
  report.exportedCount += batch.successfulInvoices.length
  report.skippedCount += batch.skippedInvoices.length
  for (const error of batch.errors) {
    report.errors.set(`${error.invoiceNumber}\u0000${error.error}`, error)
  }
  report.markFailures.push(...batch.markFailures)
}

const hasProblems = (report: CompanyExportReport) =>
  report.failure !== undefined ||
  report.errors.size > 0 ||
  report.markFailures.length > 0

const formatTimestamp = (date: Date) =>
  date.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })

const describeFailure = (
  failure: NonNullable<CompanyExportReport['failure']>
): string[] => {
  switch (failure.err) {
    case 'partial-upload':
      return [
        'Körningen avbröts: bara en del av bokföringsfilerna laddades upp till Xledger.',
        `Uppladdade filer: ${failure.detail || 'okänt'}`,
        'Avierna i batchen markerades inte som exporterade och hämtas igen vid nästa körning. Hantera de uppladdade filerna i Xledger innan dess, annars bokförs de två gånger.',
      ]
    case 'export-failed':
      return [
        `Körningen avbröts: exporten misslyckades. ${failure.detail ?? ''}`.trim(),
      ]
    case 'unknown':
      return [
        'Körningen avbröts av ett okänt fel. Se loggarna för detaljer.',
        ...(failure.detail ? [failure.detail] : []),
      ]
  }
}

const describeMarkFailure = (failure: economy.MarkInvoiceAsExportedFailure) => {
  const reason =
    failure.error === 'missing-external-id'
      ? 'saknar Tenfast-id'
      : `anropet till Tenfast misslyckades${failure.status ? ` (status ${failure.status})` : ''}`
  return `- ${failure.invoiceNumber}: ${reason}`
}

const describeCompany = (report: CompanyExportReport): string[] => {
  const lines = [
    `Företag ${report.companyId}`,
    `Exporterade avier: ${report.exportedCount}`,
    `Överhoppade avier (interna kunder): ${report.skippedCount}`,
  ]

  if (report.failure) {
    lines.push('', ...describeFailure(report.failure))
  }

  if (report.markFailures.length > 0) {
    lines.push(
      '',
      'Avier som laddats upp till Xledger men inte kunde markeras som exporterade i Tenfast. Markera dem manuellt innan nästa körning, annars bokförs de två gånger:',
      ...report.markFailures.map(describeMarkFailure)
    )
  }

  if (report.errors.size > 0) {
    lines.push('', 'Avier med fel (exporterades inte):')
    for (const error of report.errors.values()) {
      lines.push(`- ${error.invoiceNumber}: ${error.error}`)
    }
  }

  return lines
}

export const buildExportReportEmail = (
  reports: CompanyExportReport[],
  startedAt: Date,
  finishedAt: Date
): { subject: string; body: string[] } => {
  const failed = reports.some(hasProblems)
  const subject = failed
    ? 'Fel i körning: export av hyresavier till Xledger'
    : 'Körning: export av hyresavier till Xledger'

  const totalExported = reports.reduce((sum, r) => sum + r.exportedCount, 0)

  const body = [
    `Körning startad: ${formatTimestamp(startedAt)}`,
    `Körning avslutad: ${formatTimestamp(finishedAt)}`,
    `Totalt exporterade avier: ${totalExported}`,
  ]
  for (const report of reports) {
    body.push('', '---', '', ...describeCompany(report))
  }

  return { subject, body }
}
